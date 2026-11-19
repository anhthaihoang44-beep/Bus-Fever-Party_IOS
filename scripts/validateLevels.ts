import fs from 'node:fs';
import path from 'node:path';
import { LevelSolver } from '../src/systems/LevelSolver';
import type { LevelConfig } from '../src/types/game';

const levelsDir = path.resolve(process.cwd(), 'src/levels');
const files = fs
  .readdirSync(levelsDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.error('No level JSON files found in src/levels/');
  process.exit(1);
}

let hasFailure = false;

for (const file of files) {
  const fullPath = path.join(levelsDir, file);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  const level = JSON.parse(raw) as LevelConfig;

  const report = LevelSolver.solve(level);
  const paxTotal = level.passengerQueue.reduce((sum, s) => sum + s.count, 0);
  const statusTag = report.solvable ? 'PASS' : 'FAIL';

  console.log(
    `[${statusTag}] ${file} (id=${level.id}, buses=${level.buses.length}, pax=${paxTotal}, states=${report.statesExplored}, moves=${report.solutionMoves.length})`,
  );

  if (!report.solvable) {
    hasFailure = true;
    for (const issue of report.issues) {
      console.error(`   -> ${issue}`);
    }
  }
}

if (hasFailure) {
  console.error('\nLevel validation FAILED.');
  process.exit(1);
}

console.log(`\nAll ${files.length} levels validated and proven solvable without boosters!`);
