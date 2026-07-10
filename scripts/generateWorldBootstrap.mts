import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeWorldBootstrapDataHeadless } from '../src/world/worldBootstrapData.ts';

const outputPath = join(dirname(fileURLToPath(import.meta.url)), '../server/generated/world_trees.json');

const data = computeWorldBootstrapDataHeadless();
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify({ trees: data.trees }, null, 2));

console.log(`Wrote ${data.trees.length} trees to ${outputPath}`);
