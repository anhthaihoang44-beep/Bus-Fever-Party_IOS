import type {
  BusConfig,
  BusRuntime,
  Direction,
  ObstacleConfig,
} from '../types/game';

export interface Vec2 {
  x: number;
  y: number;
}

export interface OBB {
  center: Vec2;
  /** Unit forward axis along bus direction (or local X). */
  axisU: Vec2;
  /** Unit perpendicular axis (local Y). */
  axisV: Vec2;
  /** Half-extent along axisU. */
  halfU: number;
  /** Half-extent along axisV. */
  halfV: number;
}

export interface ExitCheckResult {
  canExit: boolean;
  reason?: 'not_found' | 'not_on_board' | 'locked_mystery' | 'blocked';
  blockerId?: string;
  blockerKind?: 'bus' | 'obstacle';
  /** Distance in grid units along bus direction until impact (when blocked). */
  hitDistance?: number;
}

const SQRT1_2 = Math.SQRT1_2;

export const DIRECTION_VECTORS: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  'up-left': { x: -SQRT1_2, y: -SQRT1_2 },
  'up-right': { x: SQRT1_2, y: -SQRT1_2 },
  'down-left': { x: -SQRT1_2, y: SQRT1_2 },
  'down-right': { x: SQRT1_2, y: SQRT1_2 },
};

/** Angle in radians facing the arrow direction (0 = right, -PI/2 = up). */
export function directionToRadians(direction: Direction): number {
  const v = DIRECTION_VECTORS[direction];
  return Math.atan2(v.y, v.x);
}

/** Default grid footprint dimensions for buses and obstacles. */
export const DEFAULT_BUS_LENGTH = 1.66;
export const DEFAULT_BUS_WIDTH = 0.78;
export const DEFAULT_OBSTACLE_SIZE = 0.86;

/**
 * Pure, deterministic bus board & collision system.
 * Uses exact 2D Swept Oriented Bounding Box (SAT) collision testing
 * so both orthogonal and 45-degree diagonal buses/obstacles are handled uniformly.
 */
export class BusSystem {
  private buses: Map<string, BusRuntime> = new Map();
  private obstacles: ObstacleConfig[] = [];
  private exitedCount = 0;
  public readonly cols: number;
  public readonly rows: number;

  constructor(
    cols: number,
    rows: number,
    busConfigs: BusConfig[],
    obstacles: ObstacleConfig[] = [],
  ) {
    this.cols = cols;
    this.rows = rows;
    this.obstacles = obstacles.map((obs) => ({ ...obs }));

    for (const cfg of busConfigs) {
      const unlockAfter = cfg.type === 'mystery' ? Math.max(1, cfg.unlockAfter ?? 3) : 0;
      this.buses.set(cfg.id, {
        ...cfg,
        mysteryRemaining: unlockAfter,
        unlocked: cfg.type !== 'mystery',
        state: 'board',
        boarded: 0,
        slotIndex: null,
      });
    }
  }

  public getBuses(): BusRuntime[] {
    return Array.from(this.buses.values());
  }

  public getBoardBuses(): BusRuntime[] {
    return this.getBuses().filter((b) => b.state === 'board');
  }

  public getBus(id: string): BusRuntime | undefined {
    return this.buses.get(id);
  }

  public getObstacles(): ObstacleConfig[] {
    return this.obstacles;
  }

  public getExitedCount(): number {
    return this.exitedCount;
  }

  /**
   * Computes exact OBB for a bus in grid space.
   */
  public static busToOBB(bus: Pick<BusConfig, 'x' | 'y' | 'direction' | 'length' | 'width'>): OBB {
    const u = DIRECTION_VECTORS[bus.direction];
    const v = { x: -u.y, y: u.x };
    const halfU = (bus.length ?? DEFAULT_BUS_LENGTH) * 0.5;
    const halfV = (bus.width ?? DEFAULT_BUS_WIDTH) * 0.5;
    return {
      center: { x: bus.x, y: bus.y },
      axisU: u,
      axisV: v,
      halfU,
      halfV,
    };
  }

  /**
   * Computes OBB for a static obstacle in grid space.
   */
  public static obstacleToOBB(obs: ObstacleConfig): OBB {
    const rad = ((obs.angle ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      center: { x: obs.x, y: obs.y },
      axisU: { x: cos, y: sin },
      axisV: { x: -sin, y: cos },
      halfU: (obs.width ?? DEFAULT_OBSTACLE_SIZE) * 0.5,
      halfV: (obs.height ?? DEFAULT_OBSTACLE_SIZE) * 0.5,
    };
  }

  /**
   * 2D Swept OBB vs static OBB intersection along unit velocity `dir`.
   * Returns collision time `t >= 0` (distance in grid units) or `null` if clear.
   */
  public static sweptOBBCollision(moving: OBB, dir: Vec2, target: OBB): number | null {
    const axes: Vec2[] = [moving.axisU, moving.axisV, target.axisU, target.axisV];
    const relCenter = {
      x: target.center.x - moving.center.x,
      y: target.center.y - moving.center.y,
    };

    let tEnter = 0;
    let tExit = Number.POSITIVE_INFINITY;
    const EPS = 1e-6;

    for (const axis of axes) {
      // Project half-extents onto axis
      const rA =
        moving.halfU * Math.abs(dot(moving.axisU, axis)) +
        moving.halfV * Math.abs(dot(moving.axisV, axis));
      const rB =
        target.halfU * Math.abs(dot(target.axisU, axis)) +
        target.halfV * Math.abs(dot(target.axisV, axis));
      const combinedRadius = rA + rB;

      // Signed distance from moving center to target center along axis
      const cDist = dot(relCenter, axis);
      const speed = dot(dir, axis);

      // Static interval of relative overlap: (cDist - combinedRadius) <= t * speed <= (cDist + combinedRadius)
      if (Math.abs(speed) < EPS) {
        // Moving parallel to separating axis: must strictly overlap to not separate
        // Subtract tiny epsilon so touching/parallel adjacent lanes don't falsely collide
        if (Math.abs(cDist) >= combinedRadius - 1e-4) {
          return null;
        }
      } else {
        let t1 = (cDist - combinedRadius + 1e-4) / speed;
        let t2 = (cDist + combinedRadius - 1e-4) / speed;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        tEnter = Math.max(tEnter, t1);
        tExit = Math.min(tExit, t2);
        if (tEnter > tExit || tExit <= 0) {
          return null;
        }
      }
    }

    // Only collisions strictly ahead (or immediate contact ahead) block movement
    if (tExit > 0 && tEnter <= tExit) {
      return Math.max(0, tEnter);
    }
    return null;
  }

  /**
   * Checks whether a bus on the board can exit cleanly in its arrow direction.
   */
  public checkExit(busId: string): ExitCheckResult {
    const bus = this.buses.get(busId);
    if (!bus) {
      return { canExit: false, reason: 'not_found' };
    }
    if (bus.state !== 'board') {
      return { canExit: false, reason: 'not_on_board' };
    }
    if (!bus.unlocked) {
      return { canExit: false, reason: 'locked_mystery' };
    }

    const movingOBB = BusSystem.busToOBB(bus);
    const dir = DIRECTION_VECTORS[bus.direction];

    let closestDist = Number.POSITIVE_INFINITY;
    let closestBlockerId: string | undefined;
    let closestBlockerKind: 'bus' | 'obstacle' | undefined;

    for (const other of this.buses.values()) {
      if (other.id === bus.id || other.state !== 'board') continue;
      const otherOBB = BusSystem.busToOBB(other);
      const hitDist = BusSystem.sweptOBBCollision(movingOBB, dir, otherOBB);
      if (hitDist !== null && hitDist < closestDist) {
        closestDist = hitDist;
        closestBlockerId = other.id;
        closestBlockerKind = 'bus';
      }
    }

    for (const obs of this.obstacles) {
      const obsOBB = BusSystem.obstacleToOBB(obs);
      const hitDist = BusSystem.sweptOBBCollision(movingOBB, dir, obsOBB);
      if (hitDist !== null && hitDist < closestDist) {
        closestDist = hitDist;
        closestBlockerId = obs.id;
        closestBlockerKind = 'obstacle';
      }
    }

    if (closestBlockerId !== undefined) {
      return {
        canExit: false,
        reason: 'blocked',
        blockerId: closestBlockerId,
        blockerKind: closestBlockerKind,
        hitDistance: closestDist,
      };
    }

    return { canExit: true };
  }

  /**
   * Removes an exiting bus from the board (transitions to `driving_to_slot` or caller-provided state)
   * and updates mystery bus unlock counters.
   * Returns IDs of any mystery buses that just unlocked.
   */
  public markBusExitedBoard(busId: string, nextState: BusRuntime['state'] = 'driving_to_slot'): string[] {
    const bus = this.buses.get(busId);
    if (!bus || bus.state !== 'board') return [];

    bus.state = nextState;
    this.exitedCount += 1;

    const newlyUnlocked: string[] = [];
    for (const other of this.buses.values()) {
      if (other.state === 'board' && !other.unlocked) {
        other.mysteryRemaining = Math.max(0, other.mysteryRemaining - 1);
        if (other.mysteryRemaining === 0) {
          other.unlocked = true;
          newlyUnlocked.push(other.id);
        }
      }
    }
    return newlyUnlocked;
  }

  /**
   * Returns all currently movable buses on the board.
   */
  public getMovableBuses(): BusRuntime[] {
    return this.getBoardBuses().filter((b) => this.checkExit(b.id).canExit);
  }

  /**
   * Returns true if at least one bus remaining on the board can move.
   */
  public hasAnyMovableBus(): boolean {
    return this.getBoardBuses().some((b) => this.checkExit(b.id).canExit);
  }

  /**
   * Replaces board bus layouts (used by Arrange booster or undo snapshot restore).
   */
  public restoreBuses(snapshot: BusRuntime[], exitedCount: number): void {
    this.buses.clear();
    for (const b of snapshot) {
      this.buses.set(b.id, { ...b });
    }
    this.exitedCount = exitedCount;
  }
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}
