import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LevelSolver } from '../src/systems/LevelSolver';
import type { LevelConfig } from '../src/types/game';

describe('Level JSON validation and booster-free solvability', () => {
  const levelsDir = path.resolve(process.cwd(), 'src/levels');
  const files = fs.readdirSync(levelsDir).filter((f) => f.endsWith('.json')).sort();
  const levels: LevelConfig[] = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(levelsDir, f), 'utf-8')) as LevelConfig,
  );

  it('contains at least 25 regular levels plus seasonal event level', () => {
    const regular = levels.filter((l) => !l.isEvent);
    const events = levels.filter((l) => l.isEvent);
    expect(regular.length).toBeGreaterThanOrEqual(25);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('proves every level has zero overlaps, matching color capacities, and is solvable without boosters', () => {
    for (const lvl of levels) {
      const report = LevelSolver.solve(lvl);
      expect(report.issues, `Level ${lvl.id} issues: ${report.issues.join('; ')}`).toEqual([]);
      expect(report.solvable, `Level ${lvl.id} should be solvable`).toBe(true);
    }
  });

  it('follows the gradual difficulty and special element rollout rules', () => {
    const lv1to4 = levels.filter((l) => !l.isEvent && l.id <= 4);
    for (const lvl of lv1to4) {
      expect(lvl.obstacles.length).toBe(0);
      for (const b of lvl.buses) {
        expect(['up', 'left', 'right']).toContain(b.direction);
      }
      const colors = new Set(lvl.buses.map((b) => b.color));
      expect(colors.size).toBeGreaterThanOrEqual(2);
      expect(colors.size).toBeLessThanOrEqual(4);
    }

    const lv11Plus = levels.filter((l) => !l.isEvent && l.id >= 11);
    for (const lvl of lv11Plus) {
      expect(lvl.obstacles.length).toBeGreaterThan(0);
      expect(lvl.theme).toBe('park');
    }

    const lv20Plus = levels.filter((l) => !l.isEvent && l.id >= 20);
    for (const lvl of lv20Plus) {
      const hasDiag = lvl.buses.some((b) => b.direction.includes('-'));
      const hasDark = lvl.buses.some((b) => b.color === 'brown' || b.color === 'navy');
      expect(hasDiag).toBe(true);
      expect(hasDark).toBe(true);
    }
  });
});
