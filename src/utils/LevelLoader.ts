import { InfiniteLevelGenerator } from '../systems/InfiniteLevelGenerator';
import type { LevelConfig } from '../types/game';

interface RawLevelModule {
  default: LevelConfig;
}

const levelModules = import.meta.glob<RawLevelModule>('../levels/*.json', { eager: true });

/**
 * Loads handcrafted JSON levels (1–25 + events) from `/src/levels/*.json`
 * and seamlessly generates infinite solvable levels for any levelId > 25.
 */
export class LevelLoader {
  private static levelsCache: LevelConfig[] | null = null;
  private static eventLevelsCache: LevelConfig[] | null = null;

  private static ensureLoaded(): void {
    if (this.levelsCache !== null && this.eventLevelsCache !== null) return;

    const regular: LevelConfig[] = [];
    const events: LevelConfig[] = [];

    for (const [path, mod] of Object.entries(levelModules)) {
      const cfg = mod.default;
      if (!cfg || typeof cfg.id !== 'number') {
        console.warn(`Invalid level JSON skipped: ${path}`);
        continue;
      }
      if (cfg.isEvent) {
        events.push(cfg);
      } else {
        regular.push(cfg);
      }
    }

    regular.sort((a, b) => a.id - b.id);
    events.sort((a, b) => a.id - b.id);

    this.levelsCache = regular;
    this.eventLevelsCache = events;
  }

  public static getAllLevels(): LevelConfig[] {
    this.ensureLoaded();
    return this.levelsCache ?? [];
  }

  public static getHandcraftedCount(): number {
    return this.getAllLevels().length;
  }

  public static getLevelCount(): number {
    return this.getHandcraftedCount();
  }

  public static getLevel(levelId: number): LevelConfig | undefined {
    this.ensureLoaded();
    const found = this.levelsCache?.find((lvl) => lvl.id === levelId);
    if (found) return structuredClone(found);
    if (Number.isInteger(levelId) && levelId > 0) {
      return InfiniteLevelGenerator.generate(levelId);
    }
    return undefined;
  }

  public static getEventLevels(): LevelConfig[] {
    this.ensureLoaded();
    return (this.eventLevelsCache ?? []).map((lvl) => structuredClone(lvl));
  }

  public static getEventLevel(eventId = 101): LevelConfig | undefined {
    this.ensureLoaded();
    const found = this.eventLevelsCache?.find((lvl) => lvl.id === eventId) ?? this.eventLevelsCache?.[0];
    return found ? structuredClone(found) : undefined;
  }
}
