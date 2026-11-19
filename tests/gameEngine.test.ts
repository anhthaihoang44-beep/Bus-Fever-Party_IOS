import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/systems/GameEngine';
import type { LevelConfig } from '../src/types/game';

function makeBaseLevel(overrides: Partial<LevelConfig> = {}): LevelConfig {
  return {
    id: 99,
    gridSize: { cols: 4, rows: 4 },
    buses: [
      { id: 'b1', color: 'blue', capacity: 2, x: 0.5, y: 1.0, direction: 'up', type: 'normal' },
      { id: 'b2', color: 'red', capacity: 2, x: 1.5, y: 1.0, direction: 'up', type: 'normal' },
      { id: 'b3', color: 'yellow', capacity: 2, x: 2.5, y: 1.0, direction: 'up', type: 'normal' },
    ],
    obstacles: [],
    passengerQueue: [
      { color: 'blue', count: 2 },
      { color: 'red', count: 2 },
      { color: 'yellow', count: 2 },
    ],
    trackShape: 'ring',
    theme: 'city',
    slotsUnlocked: 2,
    boostersAvailable: { vip: false, arrange: false, jumble: false },
    undoLimit: 3,
    ...overrides,
  };
}

describe('GameEngine win/lose detection and undo', () => {
  it('detects win once all passengers board', () => {
    const level = makeBaseLevel({
      buses: [
        { id: 'b1', color: 'blue', capacity: 2, x: 0.5, y: 1, direction: 'up', type: 'normal' },
      ],
      passengerQueue: [{ color: 'blue', count: 2 }],
    });

    const engine = new GameEngine(level);
    expect(engine.evaluateOutcome()).toBe('playing');

    const tap = engine.tapBus('b1', true);
    expect(tap.accepted).toBe(true);
    expect(engine.evaluateOutcome()).toBe('playing');

    engine.stepBoarding();
    expect(engine.evaluateOutcome()).toBe('playing');
    engine.stepBoarding();
    expect(engine.evaluateOutcome()).toBe('won');
  });

  it('detects lot deadlock when all unlocked slots are occupied by non-matching buses', () => {
    // Queue starts with yellow, but only 2 slots exist and player parks blue + red
    const level = makeBaseLevel({
      passengerQueue: [
        { color: 'yellow', count: 2 },
        { color: 'blue', count: 2 },
        { color: 'red', count: 2 },
      ],
      slotsUnlocked: 2,
    });

    const engine = new GameEngine(level);
    expect(engine.tapBus('b1', true).accepted).toBe(true);
    expect(engine.evaluateOutcome()).toBe('playing'); // Still 1 free slot left

    expect(engine.tapBus('b2', true).accepted).toBe(true);
    expect(engine.evaluateOutcome()).toBe('lost_lot_deadlock');
  });

  it('does not declare loss while a bus is still driving to a slot', () => {
    const level = makeBaseLevel({
      passengerQueue: [
        { color: 'yellow', count: 2 },
        { color: 'blue', count: 2 },
        { color: 'red', count: 2 },
      ],
      slotsUnlocked: 2,
    });

    const engine = new GameEngine(level);
    engine.tapBus('b1', true);
    engine.tapBus('b2', false); // b2 still 'driving_to_slot'

    expect(engine.evaluateOutcome()).toBe('playing');
    engine.busSystem.getBus('b2')!.state = 'parked';
    expect(engine.evaluateOutcome()).toBe('lost_lot_deadlock');
  });

  it('detects board-blocked loss when remaining board buses are mutually deadlocked and queue cannot move', () => {
    // Two buses facing each other head-on with nothing parked
    const level = makeBaseLevel({
      buses: [
        { id: 'left', color: 'blue', capacity: 2, x: 0.8, y: 1, direction: 'right', type: 'normal' },
        { id: 'right', color: 'red', capacity: 2, x: 2.6, y: 1, direction: 'left', type: 'normal' },
      ],
      passengerQueue: [
        { color: 'blue', count: 2 },
        { color: 'red', count: 2 },
      ],
      slotsUnlocked: 3,
    });

    const engine = new GameEngine(level);
    expect(engine.evaluateOutcome()).toBe('lost_board_blocked');
  });

  it('restores exact board, parking lot, and passenger state on undo', () => {
    const level = makeBaseLevel({ slotsUnlocked: 2 });
    const engine = new GameEngine(level);

    expect(engine.tapBus('b1', true).accepted).toBe(true);
    engine.stepBoarding();
    expect(engine.passengerSystem.getRemainingCount()).toBe(5);
    expect(engine.parkingLot.getFreeSlotCount()).toBe(1);
    expect(engine.busSystem.getBoardBuses().length).toBe(2);

    expect(engine.undo()).toBe(true);
    expect(engine.getUndoRemaining()).toBe(2);
    expect(engine.passengerSystem.getRemainingCount()).toBe(6);
    expect(engine.parkingLot.getFreeSlotCount()).toBe(2);
    expect(engine.busSystem.getBoardBuses().length).toBe(3);
    expect(engine.busSystem.getBus('b1')?.state).toBe('board');
  });
});
