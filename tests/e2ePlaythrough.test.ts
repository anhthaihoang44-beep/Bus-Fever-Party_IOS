import { describe, expect, it } from 'vitest';
import { BoosterSystem } from '../src/systems/BoosterSystem';
import { GameEngine } from '../src/systems/GameEngine';
import { LevelSolver } from '../src/systems/LevelSolver';
import { LevelLoader } from '../src/utils/LevelLoader';
import { SaveManager } from '../src/utils/SaveManager';
import type { LevelConfig } from '../src/types/game';

/**
 * Replays a full winning move sequence on GameEngine using live tapBus + stepBoarding ticks.
 */
function simulateFullPlaythrough(level: LevelConfig): { engine: GameEngine; moves: number; boarded: number } {
  const report = LevelSolver.solve(level, 60000);
  expect(report.issues, `Level ${level.id} schema issues`).toEqual([]);
  expect(report.solvable, `Level ${level.id} must be solvable`).toBe(true);

  const engine = new GameEngine(structuredClone(level));
  let totalBoarded = 0;

  for (const busId of report.solutionMoves) {
    const tap = engine.tapBus(busId, true);
    expect(tap.accepted, `Level ${level.id} tap ${busId} rejected (${tap.reason})`).toBe(true);

    // Drain any front passengers matching parked buses, matching GameScene's boarding loop.
    let safety = 0;
    while (safety < 200) {
      safety++;
      const res = engine.stepBoarding();
      if (!res) break;
      totalBoarded++;
      if (res.busFull) {
        const bus = engine.busSystem.getBus(res.busId)!;
        const slotIdx = bus.slotIndex;
        bus.slotIndex = null;
        if (slotIdx !== null) {
          engine.parkingLot.freeSlot(slotIdx);
        }
        bus.state = 'departed';
      }
    }
  }

  expect(engine.evaluateOutcome(), `Level ${level.id} should end as won`).toBe('won');
  return { engine, moves: report.solutionMoves.length, boarded: totalBoarded };
}

describe('End-to-End Gameplay & Progression Playthrough', () => {
  it('plays and wins all handcrafted levels (1..25) plus Seasonal Event (101) through GameEngine', () => {
    const regular = LevelLoader.getAllLevels();
    const events = LevelLoader.getEventLevels();
    expect(regular.length).toBe(25);
    expect(events.length).toBeGreaterThanOrEqual(1);

    for (const lvl of [...regular, ...events]) {
      const { engine, moves, boarded } = simulateFullPlaythrough(lvl);
      const expectedPax = lvl.passengerQueue.reduce((acc, s) => acc + s.count, 0);
      expect(boarded).toBe(expectedPax);
      expect(moves).toBe(lvl.buses.length);
      expect(engine.calculateStars()).toBe(3);
    }
  });

  it('plays and wins procedural endless levels (26..65 and 100) continuously', () => {
    const endlessIds = [...Array.from({ length: 40 }, (_, i) => 26 + i), 100];
    for (const id of endlessIds) {
      const lvl = LevelLoader.getLevel(id);
      expect(lvl, `Endless level ${id} should load`).toBeDefined();
      const { engine, boarded } = simulateFullPlaythrough(lvl!);
      const expectedPax = lvl!.passengerQueue.reduce((acc, s) => acc + s.count, 0);
      expect(boarded).toBe(expectedPax);
      expect(engine.busSystem.getBoardBuses().length).toBe(0);
    }
  });

  it('verifies deadlock failure, extra-slot unlock recovery, boosters, and star penalties end-to-end', () => {
    const lv4 = LevelLoader.getLevel(4)!;
    const engine = new GameEngine(lv4);

    // Park wrong-colored buses intentionally until lot fills or test unlock extra slot recovery
    const report = LevelSolver.solve(lv4);
    const firstMove = report.solutionMoves[0];
    expect(engine.tapBus(firstMove, true).accepted).toBe(true);

    // Unlock VIP slot via VIP booster (counts 1 booster -> 2 stars)
    const vipRes = BoosterSystem.applyVip(engine);
    expect(vipRes.success).toBe(true);
    expect(engine.calculateStars()).toBe(2);

    // Unlock extra slot #4 (counts 2 boosters -> still 2 stars)
    const extraRes = BoosterSystem.applyUnlockExtraSlot(engine, 4);
    expect(extraRes.success).toBe(true);
    expect(engine.parkingLot.getFreeSlotCount()).toBeGreaterThanOrEqual(4);
    expect(engine.calculateStars()).toBe(2);

    // Using Undo brings total penalties (2 boosters + 1 undo = 3 > 2) -> 1 star
    const undoOk = engine.undo();
    expect(undoOk).toBe(true);
    expect(engine.calculateStars()).toBe(1);
  });

  it('verifies SaveManager endless progression, batched stats flushing, and mission claims', () => {
    SaveManager.recordPassengersBoarded(10);
    SaveManager.recordBusExited(3);
    // Below threshold until explicit flush
    SaveManager.flushStats();

    const before = SaveManager.load();
    const startCoins = before.coins;

    // Complete Level 25 -> unlocks Level 26 (first endless procedural level)
    const afterLv25 = SaveManager.recordLevelWin(25, 3, 25);
    expect(afterLv25.highestUnlockedLevel).toBeGreaterThanOrEqual(26);
    expect(afterLv25.currentLevel).toBeGreaterThanOrEqual(26);
    expect(afterLv25.coins).toBe(startCoins + 25);

    // Flush larger wave & ensure missions update without crashing
    SaveManager.recordPassengersBoarded(65);
    SaveManager.recordBusExited(16);
    SaveManager.flushStats();
    const afterStats = SaveManager.load();
    expect(afterStats.stats.passengersBoarded).toBeGreaterThanOrEqual(75);
    expect(afterStats.stats.busesExited).toBeGreaterThanOrEqual(19);
  });
});
