import type * as THREE from 'three';
import {
  WILDFLOWER_COLORS,
  createWildflowerGeometry,
  createWildflowerMaterial,
  sampleWildflowerColor,
} from '@seedthree/core/wildflowers.js';
import { createPinnedGrassWindPosition } from './seedThreeGrass.ts';

/** The palette and modeled clump now live in SeedThree; Medieval Roads owns streaming. */
export const SEEDTHREE_WILDFLOWER_COLORS = WILDFLOWER_COLORS;

export function createSeedThreeWildflowerGeometry(): THREE.BufferGeometry {
  return createWildflowerGeometry();
}

export function createSeedThreeWildflowerMaterial(): THREE.Material {
  return createWildflowerMaterial({
    name: 'SeedThree streamed wildflowers',
    // Preserve the existing Medieval Roads stream attributes and wind motion.
    positionNode: createPinnedGrassWindPosition(),
  });
}

export function sampleSeedThreeWildflowerColor(
  paletteIndex: number,
  rng: () => number,
  out?: THREE.Color,
): THREE.Color {
  return sampleWildflowerColor(paletteIndex, rng, out);
}
