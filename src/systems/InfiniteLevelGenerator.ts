import { BoosterSystem } from './BoosterSystem';
import { BusSystem } from './BusSystem';
import { LevelSolver } from './LevelSolver';
import type {
  BusColor,
  BusConfig,
  Direction,
  LevelConfig,
  ObstacleConfig,
  PassengerSegment,
  ThemeId,
  TrackShape,
} from '../types/game';

const ALL_COLORS: BusColor[] = [
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'orange',
  'cyan',
  'brown',
  'navy',
];

const TRACK_SHAPES: TrackShape[] = ['ring', 'heart', 'snake', 'figure8'];
const THEMES: ThemeId[] = ['city', 'park', 'maple'];

const ADJECTIVES = [
  'Sunny',
  'Neon',
  'Maple',
  'Emerald',
  'Turbo',
  'Candy',
  'Royal',
  'Starlight',
  'Grand',
  'Cosmic',
];

const NOUNS = [
  'Station',
  'Crosswalk',
  'Junction',
  'Loop',
  'Boulevard',
  'Terminal',
  'Plaza',
  'Parkway',
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically generates infinite, validated, booster-free solvable levels
 * for any levelId > 25 so progression never ends.
 */
export class InfiniteLevelGenerator {
  private static cache = new Map<number, LevelConfig>();

  public static generate(levelId: number): LevelConfig {
    const cached = this.cache.get(levelId);
    if (cached) return structuredClone(cached);

    const isBoss = levelId % 5 === 0;
    const rng = mulberry32(levelId * 2654435761 + 17);

    const trackShape = TRACK_SHAPES[(levelId + Math.floor(rng() * 2)) % TRACK_SHAPES.length];
    const theme = THEMES[Math.floor((levelId - 1) / 5) % THEMES.length];
    const name = `${ADJECTIVES[levelId % ADJECTIVES.length]} ${NOUNS[(levelId * 3) % NOUNS.length]}`;

    const level = isBoss || rng() < 0.4
      ? this.buildDiagonalClusterLevel(levelId, name, trackShape, theme, isBoss, rng)
      : this.buildTiledGridLevel(levelId, name, trackShape, theme, isBoss, rng);

    this.cache.set(levelId, level);
    return structuredClone(level);
  }

  private static buildTiledGridLevel(
    levelId: number,
    name: string,
    trackShape: TrackShape,
    theme: ThemeId,
    isBoss: boolean,
    rng: () => number,
  ): LevelConfig {
    const cols = isBoss ? 7 : 6;
    const rows = 6;
    const occupied = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));

    // Place 2-5 wooden obstacles in interior cells
    const obstacles: ObstacleConfig[] = [];
    const targetObs = isBoss ? 4 : 2 + (levelId % 3);
    let obsAttempts = 0;
    while (obstacles.length < targetObs && obsAttempts < 40) {
      obsAttempts++;
      const c = 1 + Math.floor(rng() * (cols - 2));
      const r = 1 + Math.floor(rng() * (rows - 2));
      if (!occupied[r][c]) {
        occupied[r][c] = true;
        obstacles.push({ id: `o${obstacles.length + 1}`, x: c, y: r });
      }
    }

    // Pack 2-cell orthogonal buses into remaining grid cells
    const rawBuses: Array<{ x: number; y: number; dir: 'up' | 'down' | 'left' | 'right' }> = [];
    const targetBuses = isBoss ? 16 : 12 + (levelId % 4);
    const cells: Array<[number, number]> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push([c, r]);
      }
    }
    shuffleInPlace(cells, rng);

    for (const [c, r] of cells) {
      if (rawBuses.length >= targetBuses) break;
      if (occupied[r][c]) continue;

      const tryHoriz = rng() < 0.5;
      const dirs: Array<'h' | 'v'> = tryHoriz ? ['h', 'v'] : ['v', 'h'];
      for (const mode of dirs) {
        if (mode === 'h' && c + 1 < cols && !occupied[r][c + 1]) {
          occupied[r][c] = true;
          occupied[r][c + 1] = true;
          const dir = c < cols * 0.45 ? 'left' : c > cols * 0.45 ? 'right' : rng() < 0.5 ? 'left' : 'right';
          rawBuses.push({ x: c + 0.5, y: r, dir });
          break;
        }
        if (mode === 'v' && r + 1 < rows && !occupied[r + 1][c]) {
          occupied[r][c] = true;
          occupied[r + 1][c] = true;
          const dir = r < rows * 0.45 ? 'up' : r > rows * 0.45 ? 'down' : rng() < 0.5 ? 'up' : 'down';
          rawBuses.push({ x: c, y: r + 0.5, dir });
          break;
        }
      }
    }

    // Resolve any accidental mutual board cycle / obstacle traps by flipping trapped buses outward
    this.ensureBoardPeelable(cols, rows, rawBuses, obstacles, rng);

    const colorCount = Math.min(ALL_COLORS.length, isBoss ? 8 : 6 + (levelId % 2));
    const colorPool = shuffleInPlace([...ALL_COLORS], rng).slice(0, colorCount);

    return this.finalizeLevel(
      levelId,
      name,
      cols,
      rows,
      rawBuses.map((b) => ({ ...b })),
      obstacles,
      colorPool,
      trackShape,
      theme,
      isBoss ? 3 : 2,
      rng,
    );
  }

  private static buildDiagonalClusterLevel(
    levelId: number,
    name: string,
    trackShape: TrackShape,
    theme: ThemeId,
    isBoss: boolean,
    rng: () => number,
  ): LevelConfig {
    const cols = 8;
    const rows = 8;
    const uCount = isBoss ? 4 : 3;
    const vCount = 4;
    const step = 1.78;
    const uVec = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    const vVec = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
    const originX = 3.5;
    const originY = 3.5;

    const rawBuses: Array<{ x: number; y: number; dir: Direction; len: number; wid: number }> = [];
    for (let u = 0; u < uCount; u++) {
      for (let v = 0; v < vCount; v++) {
        const x = Number(
          (
            originX +
            (u - (uCount - 1) / 2) * step * uVec.x +
            (v - (vCount - 1) / 2) * step * vVec.x
          ).toFixed(2),
        );
        const y = Number(
          (
            originY +
            (u - (uCount - 1) / 2) * step * uVec.y +
            (v - (vCount - 1) / 2) * step * vVec.y
          ).toFixed(2),
        );

        // Outward-biased diagonal direction with inner variation
        let dir: Direction;
        if (u === 0 && v < vCount - 1) dir = 'up-left';
        else if (u === uCount - 1 && v > 0) dir = 'down-right';
        else if (v === 0) dir = 'up-right';
        else if (v === vCount - 1) dir = 'down-left';
        else {
          const diags: Direction[] = ['up-left', 'up-right', 'down-left', 'down-right'];
          dir = diags[Math.floor(rng() * diags.length)];
        }

        rawBuses.push({ x, y, dir, len: 1.5, wid: 0.72 });
      }
    }

    const obstacles: ObstacleConfig[] = [
      { id: 'o1', x: -1.4, y: 3.5, angle: 45, width: 0.72, height: 0.72 },
      { id: 'o2', x: 8.4, y: 3.5, angle: 45, width: 0.72, height: 0.72 },
    ];

    this.ensureDiagonalPeelable(cols, rows, rawBuses, obstacles);

    const colorCount = Math.min(ALL_COLORS.length, isBoss ? 8 : 7);
    const colorPool = shuffleInPlace([...ALL_COLORS], rng).slice(0, colorCount);

    return this.finalizeLevel(
      levelId,
      name,
      cols,
      rows,
      rawBuses,
      obstacles,
      colorPool,
      trackShape,
      theme,
      isBoss ? 3 : 2,
      rng,
    );
  }

  private static ensureBoardPeelable(
    cols: number,
    rows: number,
    rawBuses: Array<{ x: number; y: number; dir: 'up' | 'down' | 'left' | 'right' }>,
    obstacles: ObstacleConfig[],
    rng: () => number,
  ): void {
    for (let guard = 0; guard < 30; guard++) {
      const cfgs: BusConfig[] = rawBuses.map((b, i) => ({
        id: `t${i}`,
        color: 'blue',
        capacity: 6,
        x: b.x,
        y: b.y,
        direction: b.dir,
        type: 'normal',
      }));
      const sim = new BusSystem(cols, rows, cfgs, obstacles);
      while (sim.getBoardBuses().length > 0) {
        const movable = sim.getMovableBuses();
        if (movable.length === 0) break;
        sim.markBusExitedBoard(movable[0].id, 'departed');
      }
      const stuck = sim.getBoardBuses();
      if (stuck.length === 0) return;

      // Flip a stuck bus in the opposite (or outward) direction along its axis
      const target = stuck[Math.floor(rng() * stuck.length)];
      const idx = Number(target.id.slice(1));
      const cur = rawBuses[idx].dir;
      if (cur === 'left') rawBuses[idx].dir = 'right';
      else if (cur === 'right') rawBuses[idx].dir = 'left';
      else if (cur === 'up') rawBuses[idx].dir = 'down';
      else rawBuses[idx].dir = 'up';
    }
  }

  private static ensureDiagonalPeelable(
    cols: number,
    rows: number,
    rawBuses: Array<{ x: number; y: number; dir: Direction; len: number; wid: number }>,
    obstacles: ObstacleConfig[],
  ): void {
    const opp: Record<Direction, Direction> = {
      'up-left': 'down-right',
      'down-right': 'up-left',
      'up-right': 'down-left',
      'down-left': 'up-right',
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };

    for (let guard = 0; guard < 24; guard++) {
      const cfgs: BusConfig[] = rawBuses.map((b, i) => ({
        id: `d${i}`,
        color: 'blue',
        capacity: 6,
        x: b.x,
        y: b.y,
        direction: b.dir,
        type: 'normal',
        length: b.len,
        width: b.wid,
      }));
      const sim = new BusSystem(cols, rows, cfgs, obstacles);
      while (sim.getBoardBuses().length > 0) {
        const movable = sim.getMovableBuses();
        if (movable.length === 0) break;
        sim.markBusExitedBoard(movable[0].id, 'departed');
      }
      const stuck = sim.getBoardBuses();
      if (stuck.length === 0) return;

      const idx = Number(stuck[0].id.slice(1));
      rawBuses[idx].dir = opp[rawBuses[idx].dir];
    }
  }

  private static finalizeLevel(
    levelId: number,
    name: string,
    cols: number,
    rows: number,
    rawBuses: Array<{ x: number; y: number; dir: Direction; len?: number; wid?: number }>,
    obstacles: ObstacleConfig[],
    colorPool: BusColor[],
    trackShape: TrackShape,
    theme: ThemeId,
    mysteryTargetCount: number,
    rng: () => number,
  ): LevelConfig {
    const capChoices = [6, 8, 9, 10, 12];
    const obsOBBs = obstacles.map((o) => BusSystem.obstacleToOBB(o));
    const candidateBuses: BusConfig[] = rawBuses.map((b, i) => ({
      id: `b${i + 1}`,
      color: colorPool[i % colorPool.length],
      capacity: capChoices[(i + levelId) % capChoices.length],
      x: b.x,
      y: b.y,
      direction: b.dir,
      type: 'normal',
      ...(b.len ? { length: b.len } : {}),
      ...(b.wid ? { width: b.wid } : {}),
    }));

    // Ensure zero initial overlap before peeling & building passenger queue
    const buses: BusConfig[] = [];
    for (const b of candidateBuses) {
      const obb = BusSystem.busToOBB(b);
      if (obsOBBs.some((o) => BoosterSystem.obbsOverlap(obb, o))) continue;
      if (buses.some((prev) => BoosterSystem.obbsOverlap(obb, BusSystem.busToOBB(prev)))) continue;
      buses.push({ ...b, id: `b${buses.length + 1}` });
    }

    // Peel exact topological exit order first
    const sim = new BusSystem(cols, rows, buses, obstacles);
    const exitOrder: BusConfig[] = [];
    while (sim.getBoardBuses().length > 0) {
      const movable = sim.getMovableBuses();
      if (movable.length === 0) break;
      const pick = movable[Math.floor(rng() * movable.length)];
      exitOrder.push(buses.find((b) => b.id === pick.id)!);
      sim.markBusExitedBoard(pick.id, 'departed');
    }

    // Convert late-exiting buses along `exitOrder` into mystery buses safely
    const mysteryStartIdx = Math.max(4, Math.floor(exitOrder.length * 0.45));
    let assignedMystery = 0;
    for (let k = mysteryStartIdx; k < exitOrder.length && assignedMystery < mysteryTargetCount; k += 2) {
      const target = exitOrder[k];
      target.type = 'mystery';
      target.unlockAfter = Math.min(k, 4 + assignedMystery * 2);
      assignedMystery++;
    }

    // Build interleaved queue from exitOrder
    const segments: PassengerSegment[] = [];
    const scheduled = [...exitOrder];
    for (let i = 0; i < scheduled.length - 1; i += 2) {
      if (rng() < 0.6) {
        const tmp = scheduled[i];
        scheduled[i] = scheduled[i + 1];
        scheduled[i + 1] = tmp;
      }
    }

    for (const b of scheduled) {
      const prev = segments[segments.length - 1];
      if (prev && prev.color === b.color) {
        prev.count += b.capacity;
      } else {
        segments.push({ color: b.color, count: b.capacity });
      }
    }

    const level: LevelConfig = {
      id: levelId,
      name,
      gridSize: { cols, rows },
      buses,
      obstacles,
      passengerQueue: segments,
      trackShape,
      theme,
      slotsUnlocked: 3,
      boostersAvailable: {
        vip: true,
        arrange: true,
        jumble: true,
      },
      undoLimit: 4,
    };

    // Verify booster-free solvability; fallback to direct exitOrder queue if needed
    const check = LevelSolver.solve(level, 35000);
    if (!check.solvable) {
      const directSegs: PassengerSegment[] = [];
      for (const b of exitOrder) {
        const prev = directSegs[directSegs.length - 1];
        if (prev && prev.color === b.color) {
          prev.count += b.capacity;
        } else {
          directSegs.push({ color: b.color, count: b.capacity });
        }
      }
      level.passengerQueue = directSegs;
    }

    return level;
  }
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
