import { describe, expect, it } from 'vitest';
import { BoosterSystem } from '../src/systems/BoosterSystem';
import { BusSystem } from '../src/systems/BusSystem';
import { GameEngine } from '../src/systems/GameEngine';
import type { LevelConfig } from '../src/types/game';

function makeLevel(overrides: Partial<LevelConfig> = {}): LevelConfig {
  return {
    id: 14,
    gridSize: { cols: 4, rows: 4 },
    buses: [
      { id: 'b1', color: 'blue', capacity: 2, x: 0.8, y: 1.5, direction: 'right', type: 'normal' },
      { id: 'b2', color: 'red', capacity: 2, x: 2.6, y: 1.5, direction: 'left', type: 'normal' },
      { id: 'b3', color: 'yellow', capacity: 2, x: 1.5, y: 3.0, direction: 'up', type: 'normal' },
    ],
    obstacles: [{ id: 'o1', x: 1.5, y: 0.5 }],
    passengerQueue: [
      { color: 'yellow', count: 2 },
      { color: 'blue', count: 2 },
      { color: 'red', count: 2 },
    ],
    trackShape: 'heart',
    theme: 'park',
    slotsUnlocked: 3,
    boostersAvailable: { vip: true, arrange: true, jumble: true },
    ...overrides,
  };
}

describe('BoosterSystem logic and level gating', () => {
  it('enforces level-gated unlocks at Level 4 (VIP), Level 8 (Arrange), Level 13 (Jumble)', () => {
    const lv2 = makeLevel({ id: 2, boostersAvailable: {} });
    expect(BoosterSystem.isUnlockedForLevel('vip', lv2)).toBe(false);
    expect(BoosterSystem.isUnlockedForLevel('arrange', lv2)).toBe(false);
    expect(BoosterSystem.isUnlockedForLevel('jumble', lv2)).toBe(false);

    const lv4 = makeLevel({ id: 4, boostersAvailable: {} });
    expect(BoosterSystem.isUnlockedForLevel('vip', lv4)).toBe(true);
    expect(BoosterSystem.isUnlockedForLevel('arrange', lv4)).toBe(false);

    const lv8 = makeLevel({ id: 8, boostersAvailable: {} });
    expect(BoosterSystem.isUnlockedForLevel('arrange', lv8)).toBe(true);
    expect(BoosterSystem.isUnlockedForLevel('jumble', lv8)).toBe(false);

    const lv13 = makeLevel({ id: 13, boostersAvailable: {} });
    expect(BoosterSystem.isUnlockedForLevel('jumble', lv13)).toBe(true);
  });

  it('VIP booster unlocks the VIP slot', () => {
    const engine = new GameEngine(makeLevel());
    expect(engine.parkingLot.isVipUnlocked()).toBe(false);

    const res = BoosterSystem.applyVip(engine);
    expect(res.success).toBe(true);
    expect(engine.parkingLot.isVipUnlocked()).toBe(true);
    expect(engine.parkingLot.getFreeSlotCount()).toBe(4);
  });

  it('Arrange booster resolves deadlocked board buses without overlapping obstacles', () => {
    const engine = new GameEngine(makeLevel());
    // Initially b1 and b2 face head-on and b3 faces obstacle o1!
    expect(engine.busSystem.hasAnyMovableBus()).toBe(false);

    const res = BoosterSystem.applyArrange(engine);
    expect(res.success).toBe(true);
    expect(engine.busSystem.hasAnyMovableBus()).toBe(true);

    // Ensure zero overlaps among arranged buses and obstacles
    const boardBuses = engine.busSystem.getBoardBuses();
    const obsOBBs = engine.busSystem.getObstacles().map((o) => BusSystem.obstacleToOBB(o));
    for (let i = 0; i < boardBuses.length; i++) {
      const obbA = BusSystem.busToOBB(boardBuses[i]);
      for (const obs of obsOBBs) {
        expect(BoosterSystem.obbsOverlap(obbA, obs)).toBe(false);
      }
      for (let j = i + 1; j < boardBuses.length; j++) {
        const obbB = BusSystem.busToOBB(boardBuses[j]);
        expect(BoosterSystem.obbsOverlap(obbA, obbB)).toBe(false);
      }
    }
  });

  it('Jumble booster prioritizes a currently parked bus color at the front', () => {
    const engine = new GameEngine(makeLevel({
      buses: [
        { id: 'b1', color: 'blue', capacity: 2, x: 0.5, y: 1.5, direction: 'left', type: 'normal' },
        { id: 'b2', color: 'red', capacity: 2, x: 2.5, y: 1.5, direction: 'right', type: 'normal' },
        { id: 'b3', color: 'yellow', capacity: 2, x: 1.5, y: 3.0, direction: 'down', type: 'normal' },
      ],
      passengerQueue: [
        { color: 'yellow', count: 2 },
        { color: 'red', count: 2 },
        { color: 'blue', count: 2 },
      ],
    }));

    engine.tapBus('b1', true); // blue parked in slot
    expect(engine.passengerSystem.getFrontColor()).toBe('yellow');

    const res = BoosterSystem.applyJumble(engine);
    expect(res.success).toBe(true);
    expect(engine.passengerSystem.getFrontColor()).toBe('blue');
  });

  it('Unlock Extra Slot unlocks a locked + slot', () => {
    const engine = new GameEngine(makeLevel({ slotsUnlocked: 3 }));
    expect(engine.parkingLot.getUnlockedSlotCount()).toBe(3);

    const res = BoosterSystem.applyUnlockExtraSlot(engine, 4);
    expect(res.success).toBe(true);
    expect(res.slotIndex).toBe(4);
    expect(engine.parkingLot.getUnlockedSlotCount()).toBe(4);
  });
});
