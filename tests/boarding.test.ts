import { describe, expect, it } from 'vitest';
import { BusSystem } from '../src/systems/BusSystem';
import { ParkingLot } from '../src/systems/ParkingLot';
import { PassengerSystem } from '../src/systems/PassengerSystem';
import type { BusConfig } from '../src/types/game';

describe('ParkingLot and PassengerSystem boarding logic', () => {
  it('allocates normal slots before VIP slot and manages locked extra slots', () => {
    const lot = new ParkingLot(3, false);
    expect(lot.getFreeSlotCount()).toBe(3);
    expect(lot.isVipUnlocked()).toBe(false);

    expect(lot.getFirstFreeSlot()).toBe(1);
    lot.occupySlot(1, 'b1');
    expect(lot.getFirstFreeSlot()).toBe(2);
    lot.occupySlot(2, 'b2');
    expect(lot.getFirstFreeSlot()).toBe(3);
    lot.occupySlot(3, 'b3');
    expect(lot.getFirstFreeSlot()).toBeNull();

    // Unlocking VIP opens slot 0
    expect(lot.unlockVipSlot()).toBe(true);
    expect(lot.getFirstFreeSlot()).toBe(0);
    lot.occupySlot(0, 'b4');
    expect(lot.hasFreeSlot()).toBe(false);

    // Freeing a normal bus frees its slot cleanly
    expect(lot.freeBusSlot('b2')).toBe(2);
    expect(lot.getFirstFreeSlot()).toBe(2);

    // Unlocking an extra '+' slot opens slot 4
    expect(lot.unlockExtraSlot()).toBe(4);
    expect(lot.getFreeSlotCount()).toBe(2);
  });

  it('boards only the front passenger matching a parked bus and detects when bus is full', () => {
    const busConfigs: BusConfig[] = [
      { id: 'b1', color: 'blue', capacity: 2, x: 0, y: 0, direction: 'up', type: 'normal' },
      { id: 'b2', color: 'red', capacity: 2, x: 1, y: 0, direction: 'up', type: 'normal' },
    ];
    const busSystem = new BusSystem(3, 3, busConfigs);
    busSystem.markBusExitedBoard('b1', 'parked');
    busSystem.markBusExitedBoard('b2', 'parked');

    const passengers = new PassengerSystem([
      { color: 'red', count: 2 },
      { color: 'yellow', count: 1 },
      { color: 'blue', count: 2 },
    ]);

    // Front is red -> boards b2
    const r1 = passengers.tryBoardOne(busSystem.getBuses());
    expect(r1?.busId).toBe('b2');
    expect(r1?.busFull).toBe(false);

    const r2 = passengers.tryBoardOne(busSystem.getBuses());
    expect(r2?.busId).toBe('b2');
    expect(r2?.busFull).toBe(true);

    // Front is now yellow, neither b1 (blue) nor b2 (full red) matches -> blocked queue
    expect(passengers.getFrontColor()).toBe('yellow');
    expect(passengers.tryBoardOne(busSystem.getBuses())).toBeNull();
    expect(passengers.getRemainingCount()).toBe(3);
  });

  it('jumbles remaining passenger segments while preserving color counts and prioritizing parked bus color', () => {
    const passengers = new PassengerSystem([
      { color: 'yellow', count: 3 },
      { color: 'red', count: 2 },
      { color: 'blue', count: 4 },
    ]);

    passengers.jumbleSegments('blue', () => 0.25);
    expect(passengers.getFrontColor()).toBe('blue');
    expect(passengers.getRemainingCount()).toBe(9);

    const counts: Record<string, number> = {};
    for (const p of passengers.getQueue()) {
      counts[p.color] = (counts[p.color] ?? 0) + 1;
    }
    expect(counts).toEqual({ yellow: 3, red: 2, blue: 4 });
  });
});
