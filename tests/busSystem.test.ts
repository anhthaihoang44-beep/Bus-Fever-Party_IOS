import { describe, expect, it } from 'vitest';
import { BusSystem } from '../src/systems/BusSystem';
import type { BusConfig, ObstacleConfig } from '../src/types/game';

describe('BusSystem movement and blocking logic', () => {
  it('allows an unobstructed bus to exit orthogonally', () => {
    const buses: BusConfig[] = [
      { id: 'b1', color: 'blue', capacity: 6, x: 1, y: 1, direction: 'up', type: 'normal' },
    ];
    const system = new BusSystem(4, 4, buses);
    const res = system.checkExit('b1');
    expect(res.canExit).toBe(true);
  });

  it('does not falsely collide with buses in adjacent parallel lanes', () => {
    const buses: BusConfig[] = [
      { id: 'b1', color: 'blue', capacity: 6, x: 0, y: 1, direction: 'up', type: 'normal' },
      { id: 'b2', color: 'red', capacity: 6, x: 1, y: 1, direction: 'up', type: 'normal' },
      { id: 'b3', color: 'yellow', capacity: 6, x: 2, y: 1, direction: 'down', type: 'normal' },
    ];
    const system = new BusSystem(4, 4, buses);
    expect(system.checkExit('b1').canExit).toBe(true);
    expect(system.checkExit('b2').canExit).toBe(true);
    expect(system.checkExit('b3').canExit).toBe(true);
  });

  it('detects blocking by another bus ahead and clears after blocker exits', () => {
    const buses: BusConfig[] = [
      { id: 'front', color: 'red', capacity: 6, x: 2, y: 0.5, direction: 'right', type: 'normal' },
      { id: 'behind', color: 'blue', capacity: 6, x: 1.5, y: 2.0, direction: 'up', type: 'normal' },
    ];
    const system = new BusSystem(4, 4, buses);

    const blockedCheck = system.checkExit('behind');
    expect(blockedCheck.canExit).toBe(false);
    expect(blockedCheck.reason).toBe('blocked');
    expect(blockedCheck.blockerKind).toBe('bus');
    expect(blockedCheck.blockerId).toBe('front');
    expect(blockedCheck.hitDistance).toBeGreaterThan(0);

    // Front bus exits
    expect(system.checkExit('front').canExit).toBe(true);
    system.markBusExitedBoard('front');

    // Now behind bus is free
    expect(system.checkExit('behind').canExit).toBe(true);
  });

  it('detects blocking by static wooden obstacles', () => {
    const buses: BusConfig[] = [
      { id: 'b1', color: 'green', capacity: 6, x: 1, y: 2.5, direction: 'up', type: 'normal' },
    ];
    const obstacles: ObstacleConfig[] = [
      { id: 'o1', x: 1, y: 0.8 },
    ];
    const system = new BusSystem(4, 4, buses, obstacles);

    const res = system.checkExit('b1');
    expect(res.canExit).toBe(false);
    expect(res.blockerKind).toBe('obstacle');
    expect(res.blockerId).toBe('o1');
  });

  it('handles 45-degree diagonal exit and diagonal blocking accurately', () => {
    const buses: BusConfig[] = [
      { id: 'lead', color: 'purple', capacity: 6, x: 3.0, y: 1.0, direction: 'up-right', type: 'normal' },
      { id: 'tail', color: 'brown', capacity: 6, x: 1.0, y: 3.0, direction: 'up-right', type: 'normal' },
      { id: 'side', color: 'cyan', capacity: 6, x: 2.2, y: 3.0, direction: 'up-right', type: 'normal' },
    ];
    const system = new BusSystem(5, 5, buses);

    expect(system.checkExit('lead').canExit).toBe(true);
    expect(system.checkExit('tail').canExit).toBe(false);
    expect(system.checkExit('tail').blockerId).toBe('lead');
    // Parallel diagonal lane offset cleanly does not block
    expect(system.checkExit('side').canExit).toBe(true);

    system.markBusExitedBoard('lead');
    expect(system.checkExit('tail').canExit).toBe(true);
  });

  it('keeps mystery buses locked until N other buses exit', () => {
    const buses: BusConfig[] = [
      { id: 'b1', color: 'blue', capacity: 6, x: 0, y: 1, direction: 'up', type: 'normal' },
      { id: 'b2', color: 'red', capacity: 6, x: 1, y: 1, direction: 'up', type: 'normal' },
      {
        id: 'm1',
        color: 'yellow',
        capacity: 6,
        x: 2,
        y: 1,
        direction: 'up',
        type: 'mystery',
        unlockAfter: 2,
      },
    ];
    const system = new BusSystem(4, 4, buses);

    expect(system.checkExit('m1').canExit).toBe(false);
    expect(system.checkExit('m1').reason).toBe('locked_mystery');

    const unlocked1 = system.markBusExitedBoard('b1');
    expect(unlocked1).toEqual([]);
    expect(system.getBus('m1')?.mysteryRemaining).toBe(1);
    expect(system.checkExit('m1').canExit).toBe(false);

    const unlocked2 = system.markBusExitedBoard('b2');
    expect(unlocked2).toEqual(['m1']);
    expect(system.getBus('m1')?.unlocked).toBe(true);
    expect(system.checkExit('m1').canExit).toBe(true);
  });
});
