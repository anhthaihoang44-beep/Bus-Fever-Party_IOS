import type { BoosterType, MissionProgress, SaveData } from '../types/game';

const STORAGE_KEY = 'bus_fever_party_save_v1';

const DEFAULT_MISSIONS: MissionProgress[] = [
  {
    id: 'daily_win_3',
    title: 'Daily Commuter',
    description: 'Complete 3 levels',
    period: 'daily',
    target: 3,
    progress: 0,
    rewardCoins: 60,
    claimed: false,
  },
  {
    id: 'daily_board_60',
    title: 'Full House',
    description: 'Board 60 passengers',
    period: 'daily',
    target: 60,
    progress: 0,
    rewardCoins: 50,
    claimed: false,
  },
  {
    id: 'daily_buses_15',
    title: 'Traffic Master',
    description: 'Clear 15 buses from boards',
    period: 'daily',
    target: 15,
    progress: 0,
    rewardCoins: 45,
    claimed: false,
  },
  {
    id: 'weekly_win_10',
    title: 'Party Bus Legend',
    description: 'Win 10 levels this week',
    period: 'weekly',
    target: 10,
    progress: 0,
    rewardCoins: 180,
    claimed: false,
  },
  {
    id: 'weekly_boosters_3',
    title: 'Power Driver',
    description: 'Use 3 boosters',
    period: 'weekly',
    target: 3,
    progress: 0,
    rewardCoins: 120,
    claimed: false,
  },
];

function createDefaultSave(): SaveData {
  return {
    highestUnlockedLevel: 1,
    currentLevel: 1,
    coins: 120,
    starsByLevel: {},
    boosterCounts: {
      vip: 2,
      arrange: 2,
      jumble: 2,
    },
    settings: {
      soundEnabled: true,
      vibrationEnabled: true,
    },
    stats: {
      levelsWon: 0,
      busesExited: 0,
      passengersBoarded: 0,
      boostersUsed: 0,
      eventCompleted: false,
    },
    missions: DEFAULT_MISSIONS.map((m) => ({ ...m })),
  };
}

/**
 * Persists player progression, coins, stars, boosters, missions, and settings in localStorage.
 * Safely falls back to in-memory storage when running in headless Node/Vitest environments.
 */
export class SaveManager {
  private static memoryFallback: SaveData | null = null;
  private static pendingPassengers = 0;
  private static pendingBuses = 0;

  public static load(): SaveData {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SaveData>;
          const def = createDefaultSave();
          return {
            ...def,
            ...parsed,
            boosterCounts: { ...def.boosterCounts, ...(parsed.boosterCounts ?? {}) },
            settings: { ...def.settings, ...(parsed.settings ?? {}) },
            stats: { ...def.stats, ...(parsed.stats ?? {}) },
            missions:
              Array.isArray(parsed.missions) && parsed.missions.length > 0
                ? parsed.missions
                : def.missions,
          };
        }
      }
    } catch {
      // Ignore storage access errors in restricted frames
    }

    if (!this.memoryFallback) {
      this.memoryFallback = createDefaultSave();
    }
    return structuredClone(this.memoryFallback);
  }

  public static save(data: SaveData): void {
    this.memoryFallback = structuredClone(data);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {
      // Ignore quota / privacy mode errors
    }
  }

  public static recordLevelWin(
    levelId: number,
    stars: number,
    coinsEarned: number,
    isEvent = false,
  ): SaveData {
    const data = this.load();
    data.coins += coinsEarned;
    data.stats.levelsWon += 1;

    if (isEvent) {
      data.stats.eventCompleted = true;
    } else {
      const prevStars = data.starsByLevel[levelId] ?? 0;
      data.starsByLevel[levelId] = Math.max(prevStars, stars);
      if (levelId >= data.highestUnlockedLevel) {
        data.highestUnlockedLevel = levelId + 1;
      }
      data.currentLevel = Math.max(data.currentLevel, levelId + 1);
    }

    this.advanceMission(data, 'daily_win_3', 1);
    this.advanceMission(data, 'weekly_win_10', 1);
    this.save(data);
    return data;
  }

  public static recordBusExited(count = 1): void {
    this.pendingBuses += count;
    if (this.pendingBuses >= 5) {
      this.flushStats();
    }
  }

  public static recordPassengersBoarded(count: number): void {
    if (count <= 0) return;
    this.pendingPassengers += count;
    if (this.pendingPassengers >= 15) {
      this.flushStats();
    }
  }

  public static flushStats(): void {
    if (this.pendingBuses === 0 && this.pendingPassengers === 0) return;
    const data = this.load();
    if (this.pendingBuses > 0) {
      data.stats.busesExited += this.pendingBuses;
      this.advanceMission(data, 'daily_buses_15', this.pendingBuses);
      this.pendingBuses = 0;
    }
    if (this.pendingPassengers > 0) {
      data.stats.passengersBoarded += this.pendingPassengers;
      this.advanceMission(data, 'daily_board_60', this.pendingPassengers);
      this.pendingPassengers = 0;
    }
    this.save(data);
  }

  public static consumeBooster(type: BoosterType): boolean {
    const data = this.load();
    if ((data.boosterCounts[type] ?? 0) <= 0) return false;
    data.boosterCounts[type] -= 1;
    data.stats.boostersUsed += 1;
    this.advanceMission(data, 'weekly_boosters_3', 1);
    this.save(data);
    return true;
  }

  public static addBooster(type: BoosterType, amount = 1): SaveData {
    const data = this.load();
    data.boosterCounts[type] = (data.boosterCounts[type] ?? 0) + amount;
    this.save(data);
    return data;
  }

  public static spendCoins(amount: number): boolean {
    const data = this.load();
    if (data.coins < amount) return false;
    data.coins -= amount;
    this.save(data);
    return true;
  }

  public static addCoins(amount: number): SaveData {
    const data = this.load();
    data.coins += amount;
    this.save(data);
    return data;
  }

  public static claimMission(missionId: string): { success: boolean; data: SaveData } {
    const data = this.load();
    const mission = data.missions.find((m) => m.id === missionId);
    if (!mission || mission.claimed || mission.progress < mission.target) {
      return { success: false, data };
    }
    mission.claimed = true;
    data.coins += mission.rewardCoins;
    this.save(data);
    return { success: true, data };
  }

  public static updateSettings(patch: Partial<SaveData['settings']>): SaveData {
    const data = this.load();
    data.settings = { ...data.settings, ...patch };
    this.save(data);
    return data;
  }

  private static advanceMission(data: SaveData, id: string, delta: number): void {
    const m = data.missions.find((item) => item.id === id);
    if (m && !m.claimed) {
      m.progress = Math.min(m.target, m.progress + delta);
    }
  }
}
