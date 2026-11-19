import { describe, expect, it } from 'vitest';
import { InfiniteLevelGenerator } from '../src/systems/InfiniteLevelGenerator';
import { LevelSolver } from '../src/systems/LevelSolver';
import { LevelLoader } from '../src/utils/LevelLoader';

describe('Infinite procedural level generation (Level 26+)', () => {
  it('generates deterministic, valid, and booster-free solvable levels for 26..50 and 100', () => {
    const sampleIds = [...Array.from({ length: 25 }, (_, i) => 26 + i), 75, 100];

    for (const id of sampleIds) {
      const level = InfiniteLevelGenerator.generate(id);
      expect(level.id).toBe(id);
      expect(level.buses.length).toBeGreaterThanOrEqual(8);

      const report = LevelSolver.solve(level, 40000);
      expect(report.issues, `Endless Level ${id} issues: ${report.issues.join('; ')}`).toEqual([]);
      expect(report.solvable, `Endless Level ${id} should be solvable`).toBe(true);
    }
  });

  it('returns identical layout for repeated calls with the same levelId', () => {
    const a = LevelLoader.getLevel(42);
    const b = LevelLoader.getLevel(42);
    expect(a).toBeDefined();
    expect(a).toEqual(b);
  });
});
