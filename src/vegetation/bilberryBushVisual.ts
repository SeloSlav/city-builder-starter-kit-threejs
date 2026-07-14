import * as THREE from 'three';
import type { SeedThreeCardGeometrySpec } from './seedthree/seedThreeGroundCover.ts';

/**
 * Bilberry reads as a knee-to-chest shrub layer: clearly above grass tufts,
 * well below tree trunks and juniper scrub.
 */
export const BILBERRY_BUSH_CARD_SPEC: SeedThreeCardGeometrySpec = {
  quads: 8,
  width: 1.32,
  tiltMin: 0.12,
  tiltSpan: 0.36,
  heightMin: 1.05,
  heightSpan: 0.78,
  baseSpread: 0.22,
};

export const BILBERRY_BUSH_WIDTH_FACTOR = 1.48;

export function sampleBilberryBushScale(density: number, rng: () => number): number {
  const densityMul = THREE.MathUtils.lerp(1.04, 1.18, density) * 1.18;
  return THREE.MathUtils.lerp(0.9, 1.42, Math.pow(rng(), 0.74)) * densityMul;
}

export function sampleBerryPatchClumpScale(rng: () => number): number {
  return THREE.MathUtils.lerp(1.0, 1.55, Math.pow(rng(), 0.72));
}
