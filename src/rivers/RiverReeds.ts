import * as THREE from 'three';
import { grassEdgeFadeFromFocusDistance, resolveCloseGroundLod } from '../grass/grassLodMath.ts';
import type { Terrain } from '../terrain/Terrain.ts';
import type { RiverField } from './RiverField.ts';

type ReedPlacement = {
  x: number;
  z: number;
  scale: number;
  yaw: number;
  tiltX: number;
  tiltZ: number;
  hue: number;
  sat: number;
  light: number;
};

type ShoreNode = {
  x: number;
  z: number;
  outwardX: number;
  outwardZ: number;
};

export type RiverReedField = {
  group: THREE.Group;
  updateCameraState: (
    cameraPosition: THREE.Vector3,
    cameraTarget: THREE.Vector3,
    cameraDistance: number,
    firstPersonActive?: boolean,
  ) => void;
  dispose: () => void;
};

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const composeMatrix = new THREE.Matrix4();
const composeQuaternion = new THREE.Quaternion();
const composePosition = new THREE.Vector3();
const composeScale = new THREE.Vector3();
const composeEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const composeColor = new THREE.Color();

export function createRiverReeds(
  terrain: Terrain,
  riverField: RiverField,
  rng: () => number,
): RiverReedField {
  const placements = createReedPlacements(riverField, rng);
  const geometry = createReedGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0x6a8048,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: true,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(placements.length, 1));
  mesh.name = 'River reeds';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
  mesh.visible = false;
  mesh.count = placements.length;

  placements.forEach((placement, index) => {
    composeReedMatrix(placement, terrain, composeMatrix, composeQuaternion, composePosition, composeScale, composeEuler);
    mesh.setMatrixAt(index, composeMatrix);
    composeColor.setHSL(placement.hue, placement.sat, placement.light);
    mesh.setColorAt(index, composeColor);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  const group = new THREE.Group();
  group.name = 'River reeds';
  group.renderOrder = 12;
  group.add(mesh);

  let lastMaterialOpacity = Number.NaN;
  let lastFocusX = Number.NaN;
  let lastFocusZ = Number.NaN;
  let wasReedVisible = false;

  const refreshProximity = (focusX: number, focusZ: number): void => {
    if (placements.length === 0) return;

    let matrixDirty = false;
    placements.forEach((placement, index) => {
      const focusDist = Math.hypot(placement.x - focusX, placement.z - focusZ);
      const edgeFade = grassEdgeFadeFromFocusDistance(focusDist);
      if (edgeFade <= 0.02) {
        mesh.setMatrixAt(index, hiddenMatrix);
        matrixDirty = true;
        return;
      }

      composeReedMatrix(
        placement,
        terrain,
        composeMatrix,
        composeQuaternion,
        composePosition,
        composeScale,
        composeEuler,
      );
      mesh.setMatrixAt(index, composeMatrix);
      matrixDirty = true;
    });

    if (matrixDirty) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    group,
    updateCameraState(
      cameraPosition: THREE.Vector3,
      cameraTarget: THREE.Vector3,
      cameraDistance: number,
      firstPersonActive = false,
    ) {
      const { grassOpacity } = resolveCloseGroundLod(cameraDistance, firstPersonActive);
      const reedZoomVisible = grassOpacity > 0.02 && placements.length > 0;
      mesh.visible = reedZoomVisible;

      if (!Number.isFinite(lastMaterialOpacity) || Math.abs(grassOpacity - lastMaterialOpacity) > 0.008) {
        lastMaterialOpacity = grassOpacity;
        material.opacity = grassOpacity;
        const useTransparency = grassOpacity < 0.995;
        if (material.transparent !== useTransparency) {
          material.transparent = useTransparency;
          material.depthWrite = !useTransparency;
          material.needsUpdate = true;
        }
      }

      if (!reedZoomVisible) {
        wasReedVisible = false;
        lastFocusX = Number.NaN;
        lastFocusZ = Number.NaN;
        return;
      }

      const focusX = firstPersonActive ? cameraPosition.x : cameraTarget.x;
      const focusZ = firstPersonActive ? cameraPosition.z : cameraTarget.z;
      const becameVisible = !wasReedVisible;
      wasReedVisible = true;

      const focusMoved =
        becameVisible ||
        !Number.isFinite(lastFocusX) ||
        Math.hypot(focusX - lastFocusX, focusZ - lastFocusZ) >= 1.25;

      if (focusMoved) {
        refreshProximity(focusX, focusZ);
        lastFocusX = focusX;
        lastFocusZ = focusZ;
      }
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

function createReedPlacements(riverField: RiverField, rng: () => number): ReedPlacement[] {
  const placements: ReedPlacement[] = [];
  const shoreNodes = collectShoreNodes(riverField);

  for (const node of shoreNodes) {
    if (rng() > 0.82) continue;

    const tangentX = -node.outwardZ;
    const tangentZ = node.outwardX;
    const clusterCount = 2 + Math.floor(rng() * 4);

    for (let i = 0; i < clusterCount; i++) {
      const along = (rng() - 0.5) * 2.4;
      const outward = 0.15 + rng() * 1.35;
      const px = node.x + tangentX * along + node.outwardX * outward;
      const pz = node.z + tangentZ * along + node.outwardZ * outward;

      if (riverField.isRenderedWetAt(px, pz)) continue;
      if (!riverField.isGrassBlockedAt(px, pz)) continue;
      if (!hasMinimumDistance(placements, px, pz, 0.34 + rng() * 0.22)) continue;

      placements.push({
        x: px,
        z: pz,
        scale: THREE.MathUtils.lerp(1.6, 2.8, Math.pow(rng(), 1.05)),
        yaw: rng() * Math.PI * 2,
        tiltX: (rng() - 0.5) * 0.14,
        tiltZ: (rng() - 0.5) * 0.12,
        hue: 0.24 + (rng() - 0.5) * 0.03,
        sat: 0.38 + rng() * 0.12,
        light: 0.34 + rng() * 0.1,
      });
    }
  }

  appendGridReedPlacements(riverField, rng, placements);
  return placements;
}

function appendGridReedPlacements(
  riverField: RiverField,
  rng: () => number,
  placements: ReedPlacement[],
): void {
  const { resolution, startX, startZ, stepX, stepZ } = riverField;

  for (let gridZ = 0; gridZ < resolution; gridZ++) {
    for (let gridX = 0; gridX < resolution; gridX++) {
      const i = gridZ * resolution + gridX;
      if (riverField.riverMask[i] >= 0.48) continue;

      const shore = riverField.shoreDistance[i];
      if (shore < 0.55 || shore > 4.8) continue;

      const wx = startX + gridX * stepX;
      const wz = startZ + gridZ * stepZ;
      const x = wx + (rng() - 0.5) * stepX * 0.62;
      const z = wz + (rng() - 0.5) * stepZ * 0.62;
      if (riverField.isRenderedWetAt(x, z)) continue;
      if (!riverField.isGrassBlockedAt(x, z)) continue;

      const chance = THREE.MathUtils.clamp(0.42 + (1 - shore / 4.8) * 0.38, 0.2, 0.9);
      if (rng() > chance) continue;
      if (!hasMinimumDistance(placements, x, z, 0.38 + rng() * 0.24)) continue;

      placements.push({
        x,
        z,
        scale: THREE.MathUtils.lerp(1.5, 2.6, Math.pow(rng(), 1.1)),
        yaw: rng() * Math.PI * 2,
        tiltX: (rng() - 0.5) * 0.12,
        tiltZ: (rng() - 0.5) * 0.1,
        hue: 0.24 + (rng() - 0.5) * 0.03,
        sat: 0.38 + rng() * 0.12,
        light: 0.34 + rng() * 0.1,
      });
    }
  }
}

function collectShoreNodes(riverField: RiverField): ShoreNode[] {
  const { resolution, startX, startZ, stepX, stepZ } = riverField;
  const nodes: ShoreNode[] = [];

  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      if (riverField.isRenderedWetAtGrid(ix, iz)) continue;

      let outwardX = 0;
      let outwardZ = 0;
      let wetNeighbors = 0;
      const neighborDirs: Array<[number, number, number, number]> = [
        [1, 0, -1, 0],
        [-1, 0, 1, 0],
        [0, 1, 0, -1],
        [0, -1, 0, 1],
      ];

      for (const [dx, dz, ox, oz] of neighborDirs) {
        if (!riverField.isRenderedWetAtGrid(ix + dx, iz + dz)) continue;
        outwardX += ox;
        outwardZ += oz;
        wetNeighbors += 1;
      }
      if (wetNeighbors === 0) continue;

      const len = Math.hypot(outwardX, outwardZ) || 1;
      nodes.push({
        x: startX + ix * stepX,
        z: startZ + iz * stepZ,
        outwardX: outwardX / len,
        outwardZ: outwardZ / len,
      });
    }
  }

  return nodes;
}

function composeReedMatrix(
  placement: ReedPlacement,
  terrain: Terrain,
  matrix: THREE.Matrix4,
  quaternion: THREE.Quaternion,
  position: THREE.Vector3,
  scaleVector: THREE.Vector3,
  euler: THREE.Euler,
): void {
  const y = terrain.getHeightAt(placement.x, placement.z);
  position.set(placement.x, y + 0.03, placement.z);
  euler.set(placement.tiltX, placement.yaw, placement.tiltZ);
  quaternion.setFromEuler(euler);
  const width = 0.28 + placement.scale * 0.14;
  const height = placement.scale * 1.35;
  scaleVector.set(width, height, width);
  matrix.compose(position, quaternion, scaleVector);
}

function hasMinimumDistance(points: ReedPlacement[], x: number, z: number, minDistance: number): boolean {
  const minDistanceSq = minDistance * minDistance;
  for (const point of points) {
    const dx = x - point.x;
    const dz = z - point.z;
    if (dx * dx + dz * dz < minDistanceSq) return false;
  }
  return true;
}

function createReedGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const blades = 5;

  for (let blade = 0; blade < blades; blade++) {
    const angle = (blade / blades) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const halfWidth = 0.11 + (blade % 2) * 0.03;
    const base = positions.length / 3;

    // Stem base, mid, upper stem, cattail seed head.
    positions.push(
      cos * halfWidth * 0.55, 0, sin * halfWidth * 0.55,
      cos * halfWidth * 0.75, 0.58, sin * halfWidth * 0.75,
      cos * halfWidth * 0.65, 1.05, sin * halfWidth * 0.65,
      cos * halfWidth * 1.05, 1.18, sin * halfWidth * 1.05,
      cos * halfWidth * 0.95, 1.28, sin * halfWidth * 0.95,
    );
    normals.push(
      cos, 0.15, sin,
      cos, 0.55, sin,
      cos, 0.72, sin,
      cos, 0.45, sin,
      cos, 0.35, sin,
    );
    indices.push(base, base + 1, base + 2, base + 2, base + 3, base + 1, base + 3, base + 4, base + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}
