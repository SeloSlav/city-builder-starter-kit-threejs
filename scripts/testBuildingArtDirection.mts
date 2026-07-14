import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createBuildingMesh } from '../src/buildings/BuildingMeshes.ts';
import { BUILDING_KINDS } from '../src/generated/gameBalance.ts';
import { BUILD_MENU_ENTRIES, renderBuildMenuCards } from '../src/ui/buildMenuCards.ts';

const html = renderBuildMenuCards();
const urls = [...html.matchAll(/<img class="construction-card__art" src="([^"]+)"/g)].map((match) => match[1]);

if (urls.length !== BUILD_MENU_ENTRIES.length) {
  throw new Error(`Expected ${BUILD_MENU_ENTRIES.length} build-card images, found ${urls.length}.`);
}

const uniqueUrls = new Set(urls);
if (uniqueUrls.size !== urls.length) {
  throw new Error('Every construction-menu entry must reference its own named art asset.');
}

const hashes = new Map<string, string>();
for (const url of urls) {
  const file = resolve('public', url.replace(/^\//, '').replace(/^assets\//, 'assets/'));
  const bytes = readFileSync(file);
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${url} is not a PNG.`);

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 1024 || height !== 1536) {
    throw new Error(`${url} must be a 1024x1536 portrait card; found ${width}x${height}.`);
  }

  const hash = createHash('sha256').update(bytes).digest('hex');
  const duplicate = hashes.get(hash);
  if (duplicate) throw new Error(`${url} duplicates ${duplicate}; every building needs bespoke card art.`);
  hashes.set(hash, url);
}

const modelNames = new Set<string>();
for (const kind of BUILDING_KINDS) {
  const model = createBuildingMesh(kind);
  if (!model.name) throw new Error(`${kind} must have a named, dedicated model.`);
  if (modelNames.has(model.name)) throw new Error(`${kind} reuses the model identity “${model.name}”.`);
  modelNames.add(model.name);

  let meshCount = 0;
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) meshCount += 1;
  });
  if (meshCount < 4) throw new Error(`${kind} is missing a sufficiently legible procedural model (${meshCount} meshes).`);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(Number.isFinite) || size.x <= 0 || size.y <= 0 || size.z <= 0) {
    throw new Error(`${kind} produced invalid model bounds.`);
  }
}

console.log(`building art-direction tests passed (${urls.length} bespoke portrait cards, ${BUILDING_KINDS.length} dedicated models)`);
