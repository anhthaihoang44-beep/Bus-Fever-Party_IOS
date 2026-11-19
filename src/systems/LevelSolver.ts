import { BoosterSystem } from './BoosterSystem';
import { BusSystem } from './BusSystem';
import type { BusColor, BusConfig, LevelConfig } from '../types/game';

export interface ValidationIssue {
  levelId: number;
  message: string;
}

export interface SolveReport {
  solvable: boolean;
  solutionMoves: string[];
  statesExplored: number;
  issues: string[];
}

interface ParkedSimBus {
  id: string;
  color: BusColor;
  remaining: number;
}

/**
 * Validates level schema integrity (non-overlapping geometry, exact color/capacity parity)
 * and searches for a valid booster-free winning move sequence.
 */
export class LevelSolver {
  public static validateGeometryAndParity(level: LevelConfig): string[] {
    const issues: string[] = [];

    if (!level.buses || level.buses.length === 0) {
      issues.push('Level has no buses.');
      return issues;
    }

    const busIds = new Set<string>();
    const busOBBs = level.buses.map((b) => {
      if (busIds.has(b.id)) {
        issues.push(`Duplicate bus id: ${b.id}`);
      }
      busIds.add(b.id);
      if (b.capacity <= 0) {
        issues.push(`Bus ${b.id} has non-positive capacity ${b.capacity}`);
      }
      return { id: b.id, obb: BusSystem.busToOBB(b) };
    });

    const obsOBBs = (level.obstacles ?? []).map((o) => ({
      id: o.id,
      obb: BusSystem.obstacleToOBB(o),
    }));

    // Check bus-bus overlaps
    for (let i = 0; i < busOBBs.length; i++) {
      for (let j = i + 1; j < busOBBs.length; j++) {
        if (BoosterSystem.obbsOverlap(busOBBs[i].obb, busOBBs[j].obb)) {
          issues.push(`Buses ${busOBBs[i].id} and ${busOBBs[j].id} overlap initially.`);
        }
      }
    }

    // Check bus-obstacle overlaps
    for (const b of busOBBs) {
      for (const o of obsOBBs) {
        if (BoosterSystem.obbsOverlap(b.obb, o.obb)) {
          issues.push(`Bus ${b.id} overlaps obstacle ${o.id}.`);
        }
      }
    }

    // Check color parity: total bus capacity per color === total passengers per color
    const busCapByColor = new Map<BusColor, number>();
    for (const b of level.buses) {
      busCapByColor.set(b.color, (busCapByColor.get(b.color) ?? 0) + b.capacity);
    }

    const paxByColor = new Map<BusColor, number>();
    for (const seg of level.passengerQueue) {
      if (seg.count <= 0) {
        issues.push(`Passenger segment ${seg.color} has non-positive count.`);
      }
      paxByColor.set(seg.color, (paxByColor.get(seg.color) ?? 0) + seg.count);
    }

    const allColors = new Set([...busCapByColor.keys(), ...paxByColor.keys()]);
    for (const c of allColors) {
      const cap = busCapByColor.get(c) ?? 0;
      const pax = paxByColor.get(c) ?? 0;
      if (cap !== pax) {
        issues.push(`Color ${c} mismatch: bus capacity=${cap}, passengers=${pax}.`);
      }
    }

    return issues;
  }

  /**
   * Solves the level WITHOUT boosters using DFS + memoization + smart move ordering.
   */
  public static solve(level: LevelConfig, maxStates = 80000): SolveReport {
    const issues = this.validateGeometryAndParity(level);
    if (issues.length > 0) {
      return { solvable: false, solutionMoves: [], statesExplored: 0, issues };
    }

    // Precompute flattened passenger colors
    const flatQueue: BusColor[] = [];
    for (const seg of level.passengerQueue) {
      for (let i = 0; i < seg.count; i++) {
        flatQueue.push(seg.color);
      }
    }

    const buses = level.buses;
    const n = buses.length;
    const slotLimit = Math.max(1, level.slotsUnlocked ?? 3) + (level.vipUnlocked ? 1 : 0);

    // Precompute static blockers per bus: which other bus indices & obstacles block bus i
    const obsOBBs = (level.obstacles ?? []).map((o) => BusSystem.obstacleToOBB(o));
    const busOBBs = buses.map((b) => BusSystem.busToOBB(b));
    const blockedByObstacle: boolean[] = new Array(n).fill(false);
    const busBlockers: number[][] = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      const dir = getDirVec(buses[i]);
      for (const obs of obsOBBs) {
        if (BusSystem.sweptOBBCollision(busOBBs[i], dir, obs) !== null) {
          blockedByObstacle[i] = true;
          break;
        }
      }
      if (blockedByObstacle[i]) continue;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (BusSystem.sweptOBBCollision(busOBBs[i], dir, busOBBs[j]) !== null) {
          busBlockers[i].push(j);
        }
      }
    }

    const visited = new Set<string>();
    let statesExplored = 0;
    const solutionPath: string[] = [];

    const advanceBoarding = (
      parked: ParkedSimBus[],
      qIdx: number,
    ): { nextParked: ParkedSimBus[]; nextQIdx: number } => {
      const nextParked = parked.map((p) => ({ ...p }));
      let curIdx = qIdx;

      while (curIdx < flatQueue.length) {
        const frontColor = flatQueue[curIdx];
        // Pick matching parked bus with smallest remaining capacity
        let bestIdx = -1;
        for (let k = 0; k < nextParked.length; k++) {
          if (nextParked[k].color === frontColor && nextParked[k].remaining > 0) {
            if (bestIdx === -1 || nextParked[k].remaining < nextParked[bestIdx].remaining) {
              bestIdx = k;
            }
          }
        }
        if (bestIdx === -1) break;

        nextParked[bestIdx].remaining -= 1;
        curIdx += 1;
        if (nextParked[bestIdx].remaining === 0) {
          nextParked.splice(bestIdx, 1);
        }
      }

      return { nextParked, nextQIdx: curIdx };
    };

    const dfs = (
      boardMask: bigint,
      exitedCount: number,
      parked: ParkedSimBus[],
      qIdx: number,
    ): boolean => {
      if (qIdx >= flatQueue.length) {
        return true;
      }
      if (statesExplored >= maxStates) {
        return false;
      }

      if (parked.length >= slotLimit) {
        return false; // No free slot and boarding already settled
      }

      const parkedKey = parked
        .map((p) => `${p.color}:${p.remaining}`)
        .sort()
        .join(',');
      const key = `${boardMask.toString(36)}|${qIdx}|${parkedKey}`;
      if (visited.has(key)) return false;
      visited.add(key);
      statesExplored += 1;

      // Gather movable buses
      const movable: number[] = [];
      for (let i = 0; i < n; i++) {
        const bit = 1n << BigInt(i);
        if ((boardMask & bit) === 0n) continue;
        if (blockedByObstacle[i]) continue;

        const b = buses[i];
        if (b.type === 'mystery') {
          const req = Math.max(1, b.unlockAfter ?? 3);
          if (exitedCount < req) continue;
        }

        let isBlocked = false;
        for (const blockerIdx of busBlockers[i]) {
          if ((boardMask & (1n << BigInt(blockerIdx))) !== 0n) {
            isBlocked = true;
            break;
          }
        }
        if (!isBlocked) {
          movable.push(i);
        }
      }

      if (movable.length === 0) {
        return false;
      }

      // Heuristic ordering: buses matching current front color (or appearing very soon) first!
      const lookaheadColors = new Map<BusColor, number>();
      for (let off = 0; off < 32 && qIdx + off < flatQueue.length; off++) {
        const c = flatQueue[qIdx + off];
        if (!lookaheadColors.has(c)) {
          lookaheadColors.set(c, off);
        }
      }

      movable.sort((ia, ib) => {
        const sa = lookaheadColors.get(buses[ia].color) ?? 999;
        const sb = lookaheadColors.get(buses[ib].color) ?? 999;
        return sa - sb;
      });

      for (const idx of movable) {
        const b = buses[idx];
        const nextMask = boardMask & ~(1n << BigInt(idx));
        const addedParked = [
          ...parked,
          { id: b.id, color: b.color, remaining: b.capacity },
        ];
        const { nextParked, nextQIdx } = advanceBoarding(addedParked, qIdx);

        solutionPath.push(b.id);
        if (dfs(nextMask, exitedCount + 1, nextParked, nextQIdx)) {
          return true;
        }
        solutionPath.pop();
      }

      return false;
    };

    const fullMask = (1n << BigInt(n)) - 1n;
    const solvable = dfs(fullMask, 0, [], 0);
    return {
      solvable,
      solutionMoves: solvable ? [...solutionPath] : [],
      statesExplored,
      issues: solvable ? [] : ['No booster-free solution found within search budget.'],
    };
  }
}

function getDirVec(b: BusConfig) {
  switch (b.direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'up-left':
      return { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
    case 'up-right':
      return { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
    case 'down-left':
      return { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
    case 'down-right':
      return { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  }
}
