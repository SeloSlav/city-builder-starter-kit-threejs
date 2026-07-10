import * as THREE from 'three';
import type { Terrain } from '../terrain/Terrain.ts';
import type { RoadNetwork } from '../roads/RoadNetwork.ts';
import { distancePointToPolylineXZ } from '../utils/pathGeometry.ts';

const WEAR_INNER_MARGIN = -0.18;
/** Keep terrain wear under the opaque core only; the mesh shoulder handles the grass fade. */
const WEAR_OUTER_MARGIN = 0.32;
const WEAR_SOFTEN_CENTER_WEIGHT = 0.48;
const WEAR_SOFTEN_CARDINAL_WEIGHT = 0.22;
const WEAR_SOFTEN_DIAGONAL_WEIGHT = 0.1;

type RoadWearPath = {
  path: THREE.Vector3[];
  halfWidth: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function updateTerrainRoadWear(terrain: Terrain, network: RoadNetwork): void {
  const geometry = terrain.mesh.geometry;
  const wearAttr = geometry.getAttribute('roadWearBlend') as THREE.BufferAttribute | undefined;
  if (!wearAttr) return;

  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const edges = [...network.edges.values()];
  const roadPaths = edges
    .map((edge) => createRoadWearPath(
      edge.sampledPath.length >= 2 ? edge.sampledPath : edge.controlPoints,
      edge.width * 0.5,
    ))
    .filter((entry): entry is RoadWearPath => entry !== null);

  const rawWear = new Float32Array(positions.count);

  for (let i = 0; i < positions.count; i++) {
    rawWear[i] = sampleRoadWearAt(positions.getX(i), positions.getZ(i), roadPaths);
  }

  const values = positions.count === terrain.resolution * terrain.resolution
    ? softenGridMask(rawWear, terrain.resolution)
    : rawWear;
  (wearAttr.array as Float32Array).set(values);
  wearAttr.needsUpdate = true;
}

function createRoadWearPath(path: THREE.Vector3[], halfWidth: number): RoadWearPath | null {
  if (path.length < 2) return null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  const outer = halfWidth + WEAR_OUTER_MARGIN;

  for (const point of path) {
    minX = Math.min(minX, point.x - outer);
    maxX = Math.max(maxX, point.x + outer);
    minZ = Math.min(minZ, point.z - outer);
    maxZ = Math.max(maxZ, point.z + outer);
  }

  return { path, halfWidth, minX, maxX, minZ, maxZ };
}

function sampleRoadWearAt(x: number, z: number, roadPaths: RoadWearPath[]): number {
  let wear = 0;
  for (const roadPath of roadPaths) {
    if (x < roadPath.minX || x > roadPath.maxX || z < roadPath.minZ || z > roadPath.maxZ) continue;
    wear = Math.max(wear, sampleSingleRoadWearAt(x, z, roadPath));
  }
  return wear;
}

function sampleSingleRoadWearAt(x: number, z: number, roadPath: RoadWearPath): number {
  const distance = distancePointToPolylineXZ(x, z, roadPath.path);
  const inner = roadPath.halfWidth + WEAR_INNER_MARGIN;
  const outer = roadPath.halfWidth + WEAR_OUTER_MARGIN;
  if (distance > outer) return 0;
  return 1 - smoothstep(inner, outer, distance);
}

function softenGridMask(values: Float32Array, resolution: number): Float32Array {
  const softened = new Float32Array(values.length);

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const i = z * resolution + x;
      let sum = values[i] * WEAR_SOFTEN_CENTER_WEIGHT;
      let weight = WEAR_SOFTEN_CENTER_WEIGHT;

      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = x + dx;
          const nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= resolution || nz >= resolution) continue;
          const sampleWeight = dx === 0 || dz === 0
            ? WEAR_SOFTEN_CARDINAL_WEIGHT
            : WEAR_SOFTEN_DIAGONAL_WEIGHT;
          sum += values[nz * resolution + nx] * sampleWeight;
          weight += sampleWeight;
        }
      }

      softened[i] = sum / weight;
    }
  }

  return softened;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 === edge0) return value < edge0 ? 0 : 1;
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
