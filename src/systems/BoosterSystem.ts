import {
  BusSystem,
  DIRECTION_VECTORS,
  type OBB,
} from './BusSystem';
import type { GameEngine } from './GameEngine';
import {
  BOOSTER_UNLOCK_LEVEL,
  type BoosterType,
  type BusRuntime,
  type Direction,
  type LevelConfig,
} from '../types/game';

export interface BoosterActionResult {
  success: boolean;
  message: string;
  slotIndex?: number;
}

/**
 * Handles level-gated booster availability and deterministic execution of:
 * - VIP: unlocks the gold VIP slot
 * - Arrange: re-sorts/re-orients remaining board buses to free exit paths
 * - Jumble: shuffles remaining passenger color segments (prioritizing parked bus color)
 * - Unlock Slot: unlocks one of the '+' extra parking slots
 */
export class BoosterSystem {
  public static getUnlockLevel(type: BoosterType): number {
    return BOOSTER_UNLOCK_LEVEL[type];
  }

  public static isUnlockedForLevel(type: BoosterType, level: LevelConfig): boolean {
    if (level.boostersAvailable?.[type] === true) return true;
    if (level.boostersAvailable?.[type] === false && level.id < BOOSTER_UNLOCK_LEVEL[type]) {
      return false;
    }
    return level.isEvent || level.id >= BOOSTER_UNLOCK_LEVEL[type];
  }

  public static applyVip(engine: GameEngine): BoosterActionResult {
    if (engine.parkingLot.isVipUnlocked()) {
      return { success: false, message: 'VIP slot is already unlocked!' };
    }
    engine.captureSnapshot();
    engine.parkingLot.unlockVipSlot();
    engine.markBoosterUsed();
    return { success: true, message: 'VIP slot unlocked!', slotIndex: 0 };
  }

  public static applyJumble(engine: GameEngine): BoosterActionResult {
    if (engine.passengerSystem.getRemainingCount() <= 1) {
      return { success: false, message: 'Not enough passengers to jumble!' };
    }

    engine.captureSnapshot();
    const parked = engine.busSystem
      .getBuses()
      .filter((b) => b.state === 'parked' && b.boarded < b.capacity);

    const preferredColor = parked[0]?.color ?? null;
    engine.passengerSystem.jumbleSegments(preferredColor);
    engine.markBoosterUsed();
    return { success: true, message: 'Passenger queue jumbled!' };
  }

  /**
   * Re-orients and re-arranges remaining board buses so front-needed buses
   * have clear paths without overlapping obstacles or deadlocking each other.
   */
  public static applyArrange(engine: GameEngine): BoosterActionResult {
    const boardBuses = engine.busSystem.getBoardBuses();
    if (boardBuses.length === 0) {
      return { success: false, message: 'No buses left on the board!' };
    }

    engine.captureSnapshot();

    // Order board buses by earliest need in passenger queue
    const queue = engine.passengerSystem.getQueue();
    const firstColorPos = new Map<string, number>();
    for (let i = 0; i < queue.length; i++) {
      if (!firstColorPos.has(queue[i].color)) {
        firstColorPos.set(queue[i].color, i);
      }
    }

    const sortedBuses = [...boardBuses].sort((a, b) => {
      const pa = firstColorPos.get(a.color) ?? Number.MAX_SAFE_INTEGER;
      const pb = firstColorPos.get(b.color) ?? Number.MAX_SAFE_INTEGER;
      return pa - pb;
    });

    const obstacles = engine.busSystem.getObstacles();
    const obstacleOBBs = obstacles.map((o) => BusSystem.obstacleToOBB(o));
    const cols = engine.busSystem.cols;
    const rows = engine.busSystem.rows;

    // Candidate grid positions: preserve existing centers first, then clean lane grid spots
    const candidateCenters: Array<{ x: number; y: number }> = boardBuses.map((b) => ({
      x: b.x,
      y: b.y,
    }));
    for (let r = 0.5; r <= rows - 0.5; r += 0.5) {
      for (let c = 0.5; c <= cols - 0.5; c += 0.5) {
        candidateCenters.push({ x: c, y: r });
      }
    }

    const placed: BusRuntime[] = [];
    const placedOBBs: OBB[] = [];

    for (const bus of sortedBuses) {
      const best = this.findBestClearPlacement(
        bus,
        candidateCenters,
        cols,
        rows,
        obstacleOBBs,
        placed,
        placedOBBs,
      );

      const updated: BusRuntime = {
        ...bus,
        x: best.x,
        y: best.y,
        direction: best.direction,
      };
      placed.push(updated);
      placedOBBs.push(BusSystem.busToOBB(updated));
    }

    // Reassemble full bus array preserving non-board buses intact
    const nonBoard = engine.busSystem
      .getBuses()
      .filter((b) => b.state !== 'board')
      .map((b) => ({ ...b }));

    engine.busSystem.restoreBuses(
      [...nonBoard, ...placed],
      engine.busSystem.getExitedCount(),
    );
    engine.markBoosterUsed();
    return { success: true, message: 'Buses arranged to clear paths!' };
  }

  public static applyUnlockExtraSlot(
    engine: GameEngine,
    slotIndex?: number,
  ): BoosterActionResult {
    const unlockedIdx = engine.parkingLot.unlockExtraSlot(slotIndex);
    if (unlockedIdx === null) {
      return { success: false, message: 'No locked slots remaining!' };
    }
    engine.markBoosterUsed();
    return {
      success: true,
      message: 'Extra parking slot unlocked!',
      slotIndex: unlockedIdx,
    };
  }

  private static findBestClearPlacement(
    bus: BusRuntime,
    candidateCenters: Array<{ x: number; y: number }>,
    cols: number,
    rows: number,
    obstacleOBBs: OBB[],
    alreadyPlaced: BusRuntime[],
    alreadyPlacedOBBs: OBB[],
  ): { x: number; y: number; direction: Direction } {
    const dirs: Direction[] = ['up', 'down', 'left', 'right'];
    let fallback: { x: number; y: number; direction: Direction } | null = null;

    // Prefer keeping bus near its current coordinate, pointing outward toward nearest free border
    const scoredCenters = [...candidateCenters].sort((a, b) => {
      const da = Math.hypot(a.x - bus.x, a.y - bus.y);
      const db = Math.hypot(b.x - bus.x, b.y - bus.y);
      return da - db;
    });

    for (const pt of scoredCenters) {
      // Order directions toward closest board edge
      const sortedDirs = [...dirs].sort((d1, d2) => {
        const edgeDist = (d: Direction) => {
          if (d === 'up') return pt.y;
          if (d === 'down') return rows - pt.y;
          if (d === 'left') return pt.x;
          return cols - pt.x;
        };
        return edgeDist(d1) - edgeDist(d2);
      });

      for (const dir of sortedDirs) {
        const probe: BusRuntime = { ...bus, x: pt.x, y: pt.y, direction: dir };
        const probeOBB = BusSystem.busToOBB(probe);

        // Bounds check (allow slight half-cell fit inside grid)
        const minX = 0.25;
        const maxX = cols - 0.25;
        const minY = 0.25;
        const maxY = rows - 0.25;
        if (pt.x < minX || pt.x > maxX || pt.y < minY || pt.y > maxY) {
          continue;
        }

        // Must not overlap any obstacle or already placed bus
        if (obstacleOBBs.some((obs) => this.obbsOverlap(probeOBB, obs))) continue;
        if (alreadyPlacedOBBs.some((b) => this.obbsOverlap(probeOBB, b))) continue;

        const dirVec = DIRECTION_VECTORS[dir];

        // Must not be permanently blocked by any obstacle along exit ray
        const blockedByObstacle = obstacleOBBs.some(
          (obs) => BusSystem.sweptOBBCollision(probeOBB, dirVec, obs) !== null,
        );
        if (blockedByObstacle) continue;

        if (!fallback) {
          fallback = { x: pt.x, y: pt.y, direction: dir };
        }

        // Ideal: also not blocked by any already-placed higher-priority bus, AND does not block earlier placed buses!
        const blockedByPlaced = alreadyPlacedOBBs.some(
          (b) => BusSystem.sweptOBBCollision(probeOBB, dirVec, b) !== null,
        );
        const blocksPlaced = alreadyPlaced.some((prev, idx) => {
          const prevVec = DIRECTION_VECTORS[prev.direction];
          return BusSystem.sweptOBBCollision(alreadyPlacedOBBs[idx], prevVec, probeOBB) !== null;
        });

        if (!blockedByPlaced && !blocksPlaced) {
          return { x: pt.x, y: pt.y, direction: dir };
        }
      }
    }

    return fallback ?? { x: bus.x, y: bus.y, direction: bus.direction };
  }

  /**
   * Static 2D SAT overlap check between two OBBs.
   */
  public static obbsOverlap(a: OBB, b: OBB): boolean {
    const axes = [a.axisU, a.axisV, b.axisU, b.axisV];
    const dx = b.center.x - a.center.x;
    const dy = b.center.y - a.center.y;

    for (const axis of axes) {
      const projDist = Math.abs(dx * axis.x + dy * axis.y);
      const rA =
        a.halfU * Math.abs(a.axisU.x * axis.x + a.axisU.y * axis.y) +
        a.halfV * Math.abs(a.axisV.x * axis.x + a.axisV.y * axis.y);
      const rB =
        b.halfU * Math.abs(b.axisU.x * axis.x + b.axisU.y * axis.y) +
        b.halfV * Math.abs(b.axisV.x * axis.x + b.axisV.y * axis.y);

      if (projDist >= rA + rB - 1e-4) {
        return false;
      }
    }
    return true;
  }
}
