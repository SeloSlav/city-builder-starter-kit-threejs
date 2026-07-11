import assert from 'node:assert/strict';
import type { WorldConfig } from '../src/generated/types.ts';
import {
  decodeMapSize,
  encodeMapSize,
  generationMatchesServer,
  settingsToConfigurePayload,
  worldConfigRowToGeneration,
} from '../src/world/worldConfigAuthority.ts';
import { DEFAULT_WORLD_GENERATION_SETTINGS } from '../src/world/worldGenerationSettings.ts';

assert.equal(encodeMapSize('medium'), 1);
assert.equal(decodeMapSize(2), 'large');

const row = {
  id: 0,
  seed: BigInt(0xdeadbeef),
  nextBuildingId: BigInt(1),
  simTick: BigInt(0),
  mapSize: 1,
  topography: 42,
  hydrology: 55,
  forestDensity: 66,
  configured: true,
} satisfies WorldConfig;

const generation = worldConfigRowToGeneration(row);
assert.equal(generation.seed, 0xdeadbeef);
assert.equal(generation.mapSize, 'medium');
assert.equal(generation.topography, 42);
assert.equal(generation.configured, true);

assert.equal(
  generationMatchesServer(generation, DEFAULT_WORLD_GENERATION_SETTINGS),
  false,
);

const payload = settingsToConfigurePayload(DEFAULT_WORLD_GENERATION_SETTINGS);
assert.equal(payload.mapSize, 1);
assert.equal(payload.seed, BigInt(DEFAULT_WORLD_GENERATION_SETTINGS.seed));

console.log('world config authority tests passed');
