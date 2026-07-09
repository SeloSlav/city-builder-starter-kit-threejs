import { uniform } from 'three/tsl';

/**
 * Orbit-camera distance (target ↔ camera). Drives a global LOD crossfade so the
 * whole terrain transitions together instead of per-fragment 3D distance, which
 * kept most of the ground on the far texture even when zoomed in.
 */
export const grassCameraDistance = uniform(88);

/** Shared fade distances for grass mesh opacity and terrain colour LOD (world units). */
export const GRASS_LOD = {
  /** Full instanced grass + detailed terrain texture. */
  near: 115,
  /** No instanced grass + simplified far terrain grass colour. */
  far: 210,
} as const;

export function updateGrassCameraDistance(distance: number): void {
  grassCameraDistance.value = distance;
}
