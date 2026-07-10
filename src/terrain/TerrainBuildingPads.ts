import * as THREE from 'three';
import type { BuildingTerrainLayout } from '../buildings/BuildingTerrainLayout.ts';
import type { Terrain, TerrainBounds } from './Terrain.ts';
import { sampleBaseTerrainHeight } from './TerrainHeight.ts';

let previousBounds: TerrainBounds[] = [];

export function updateTerrainBuildingPads(terrain: Terrain, layout: BuildingTerrainLayout | null): void {
  const geometry = terrain.mesh.geometry;
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const currentBounds = layout?.getAffectedBounds() ?? [];
  const boundsToUpdate = mergeBounds(previousBounds, currentBounds);

  if (boundsToUpdate.length === 0) {
    previousBounds = [];
    return;
  }

  const resolution = terrain.resolution;
  const size = terrain.size;
  const step = size / (resolution - 1);
  const half = size * 0.5;

  for (const bounds of boundsToUpdate) {
    const minXIndex = Math.max(0, Math.floor((bounds.minX + half) / step));
    const maxXIndex = Math.min(resolution - 1, Math.ceil((bounds.maxX + half) / step));
    const minZIndex = Math.max(0, Math.floor((bounds.minZ + half) / step));
    const maxZIndex = Math.min(resolution - 1, Math.ceil((bounds.maxZ + half) / step));

    for (let zIndex = minZIndex; zIndex <= maxZIndex; zIndex++) {
      const rowOffset = zIndex * resolution;
      for (let xIndex = minXIndex; xIndex <= maxXIndex; xIndex++) {
        const vertexIndex = rowOffset + xIndex;
        const positionOffset = vertexIndex * 3;
        const x = positions.array[positionOffset] as number;
        const z = positions.array[positionOffset + 2] as number;
        positions.array[positionOffset + 1] = sampleBaseTerrainHeight(x, z);
      }
    }
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  previousBounds = boundsToUpdate;
}

export function resetTerrainBuildingPadHistory(): void {
  previousBounds = [];
}

function mergeBounds(previous: TerrainBounds[], current: TerrainBounds[]): TerrainBounds[] {
  const merged = [...previous];
  for (const bounds of current) {
    if (!merged.some((entry) => boundsEqual(entry, bounds))) {
      merged.push(bounds);
    }
  }
  return merged;
}

function boundsEqual(a: TerrainBounds, b: TerrainBounds): boolean {
  return a.minX === b.minX && a.maxX === b.maxX && a.minZ === b.minZ && a.maxZ === b.maxZ;
}
