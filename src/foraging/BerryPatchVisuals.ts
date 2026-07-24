import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { Terrain } from '../terrain/Terrain.ts';
import type { RendererBackendKind } from '../scene/RendererBackend.ts';
import { mulberry32 } from '../props/forestField.ts';
import { seedThreeLeafUrl } from '../vegetation/seedthree/seedThreeTextures.ts';
import { createRootedFoliageWindPosition } from '../vegetation/seedthree/seedThreeFoliageWind.ts';
import {
  BILBERRY_BUSH_CARD_SPEC,
  sampleBerryPatchClumpScale,
} from '../vegetation/bilberryBushVisual.ts';
import {
  addSeedThreeGroundCoverInstanceAttributes,
  createSeedThreeCardClumpGeometry,
  createSeedThreeGroundCoverMaterial,
  disposeSeedThreeGroundCoverTextures,
  loadSeedThreeGroundCoverTextures,
  seedThreeGroundCoverWindVector,
} from '../vegetation/seedthree/seedThreeGroundCover.ts';
import type { ForagingSite } from './ForagingLayout.ts';
import type { ForagingNodeState } from '../resources/types.ts';
import { isForagingHarvestAvailable } from './foragingSeason.ts';

type BerryClumpPlacement = {
  nodeId: string;
  x: number;
  z: number;
  yaw: number;
  scale: number;
};

export type BerryPatchVisuals = {
  group: THREE.Group;
  placements: ReadonlyArray<BerryClumpPlacement>;
  sync: (nodes: Iterable<ForagingNodeState>, month: number) => void;
  dispose: () => void;
};

const TAU = Math.PI * 2;
const CLUMPS_PER_PATCH = 22;
const PATCH_RADIUS = 9.6;
const BERRIES_PER_CLUMP = 12;
const BERRY_RED = 0xff2d24;

/**
 * Turns the authoritative berry resource sites into visible SeedThree bilberry beds.
 * The sites remain gameplay-owned; this layer only provides their physical footprint.
 */
export async function createBerryPatchVisuals(
  terrain: Terrain,
  sites: ReadonlyArray<ForagingSite>,
  maxAnisotropy: number,
  rendererBackend: RendererBackendKind,
  seed: number,
  isBlockedAt?: (x: number, z: number) => boolean,
): Promise<BerryPatchVisuals> {
  const berrySites = sites.filter((site) => site.kind === 'berries');
  const rng = mulberry32(seed ^ 0xb3e771);
  const placements = createBerryClumpPlacements(berrySites, rng, isBlockedAt);
  const textures = await loadSeedThreeGroundCoverTextures({
    albedo: seedThreeLeafUrl('bilberry_albedo.png'),
    normal: seedThreeLeafUrl('bilberry_normal.png'),
    roughness: seedThreeLeafUrl('bilberry_roughness.png'),
    translucency: seedThreeLeafUrl('bilberry_translucency.png'),
  }, maxAnisotropy);
  const material = createSeedThreeGroundCoverMaterial(
    'SeedThree berry resource patch',
    textures,
    rendererBackend,
    [0.3, 0.44, 0.16],
    0.15,
  );
  const geometry = createSeedThreeCardClumpGeometry(BILBERRY_BUSH_CARD_SPEC);
  const capacity = Math.max(placements.length, 1);
  const attributes = addSeedThreeGroundCoverInstanceAttributes(geometry, capacity);
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.name = 'SeedThree berry resource patch cards';
  mesh.count = placements.length;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;

  const berryGeometry = createHarvestableBerryGeometry();
  const berryMaterial = createHarvestableBerryMaterial(rendererBackend);
  const berryAnchor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const berryWind = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  berryGeometry.setAttribute('aAnchorPos', berryAnchor);
  berryGeometry.setAttribute('aWindVec', berryWind);
  const berries = new THREE.InstancedMesh(berryGeometry, berryMaterial, capacity);
  berries.name = 'Bright red harvestable berry clusters';
  berries.count = placements.length;
  berries.castShadow = false;
  berries.receiveShadow = true;
  berries.renderOrder = 4;
  berries.frustumCulled = false;

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const tint = new THREE.Color();
  const wind = new THREE.Vector3();
  const berryMatrices: THREE.Matrix4[] = [];

  placements.forEach((placement, index) => {
    const y = terrain.getHeightAt(placement.x, placement.z) + 0.07;
    const leanDirection = rng() * TAU;
    const lean = THREE.MathUtils.lerp(0.035, 0.13, rng());
    position.set(placement.x, y, placement.z);
    quaternion.setFromEuler(new THREE.Euler(
      Math.cos(leanDirection) * lean,
      placement.yaw,
      Math.sin(leanDirection) * lean * 0.7,
      'YXZ',
    ));
    const width = placement.scale * THREE.MathUtils.lerp(1.15, 1.42, rng());
    const height = placement.scale * THREE.MathUtils.lerp(0.92, 1.14, rng());
    scale.set(width, height, width);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    berries.setMatrixAt(index, matrix);
    berryMatrices.push(matrix.clone());

    const tintR = THREE.MathUtils.lerp(0.58, 0.76, rng());
    const tintG = THREE.MathUtils.lerp(0.64, 0.84, rng());
    const tintB = THREE.MathUtils.lerp(0.56, 0.74, rng());
    attributes.tint.setXYZ(index, tintR, tintG, tintB);
    attributes.anchor.setXYZ(index, position.x, position.y, position.z);
    seedThreeGroundCoverWindVector(placement.yaw, scale, wind);
    attributes.wind.setXYZ(index, wind.x, wind.y, wind.z);
    berryAnchor.setXYZ(index, position.x, position.y, position.z);
    berryWind.setXYZ(index, wind.x, wind.y, wind.z);
    tint.setRGB(tintR, tintG, tintB);
    mesh.setColorAt(index, tint);
  });

  mesh.instanceMatrix.needsUpdate = true;
  attributes.tint.needsUpdate = true;
  attributes.anchor.needsUpdate = true;
  attributes.wind.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  berries.instanceMatrix.needsUpdate = true;
  berryAnchor.needsUpdate = true;
  berryWind.needsUpdate = true;

  const group = new THREE.Group();
  group.name = 'SeedThree berry resource patches';
  group.userData.berryPatchCenters = berrySites.map((site, index) => ({
    nodeId: `foraging-berries-${index}`,
    x: site.x,
    z: site.z,
  }));
  group.add(mesh, berries);

  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const sync = (nodes: Iterable<ForagingNodeState>, month: number): void => {
    const byId = new Map(
      Array.from(nodes, (node) => [node.nodeId, node] as const),
    );
    const seasonAvailable = isForagingHarvestAvailable('berries', month);
    placements.forEach((placement, index) => {
      const node = byId.get(placement.nodeId);
      const stockRatio = node && node.maxYield > 0
        ? THREE.MathUtils.clamp(node.remaining / node.maxYield, 0, 1)
        : 0;
      const visible = seasonAvailable && hash01(index * 7.31 + 21.7) < stockRatio;
      berries.setMatrixAt(index, visible ? berryMatrices[index] : hiddenMatrix);
    });
    berries.instanceMatrix.needsUpdate = true;
  };

  return {
    group,
    placements,
    sync,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      berryGeometry.dispose();
      berryMaterial.dispose();
      disposeSeedThreeGroundCoverTextures(textures);
    },
  };
}

/**
 * One low-poly fruit load shared by every harvestable clump. Instancing this
 * combined geometry keeps the entire berry resource layer to one extra draw.
 */
export function createHarvestableBerryGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let berry = 0; berry < BERRIES_PER_CLUMP; berry++) {
    const angle = berry * 2.399963 + hash01(berry + 4.7) * 0.42;
    const canopyRadius = THREE.MathUtils.lerp(0.34, 0.72, hash01(berry + 8.3));
    const center = new THREE.Vector3(
      Math.cos(angle) * canopyRadius,
      THREE.MathUtils.lerp(0.58, 1.52, hash01(berry + 2.1)),
      Math.sin(angle) * canopyRadius,
    );
    const radius = THREE.MathUtils.lerp(0.052, 0.07, hash01(berry + 12.9));
    appendBerryIcosahedron(positions, normals, uvs, indices, center, radius);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

function createHarvestableBerryMaterial(rendererBackend: RendererBackendKind): THREE.Material {
  if (rendererBackend === 'webgl') {
    return new THREE.MeshStandardMaterial({
      name: 'Bright red harvestable berries',
      color: BERRY_RED,
      emissive: 0x6f0906,
      emissiveIntensity: 0.32,
      roughness: 0.7,
      metalness: 0,
    });
  }

  const material = new MeshStandardNodeMaterial();
  material.name = 'Bright red harvestable berries';
  material.color.setHex(BERRY_RED);
  material.roughness = 0.7;
  material.metalness = 0;
  material.positionNode = createRootedFoliageWindPosition(0.15);
  return material;
}

function appendBerryIcosahedron(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  center: THREE.Vector3,
  radius: number,
): void {
  const phi = (1 + Math.sqrt(5)) * 0.5;
  const localVertices = [
    new THREE.Vector3(-1, phi, 0),
    new THREE.Vector3(1, phi, 0),
    new THREE.Vector3(-1, -phi, 0),
    new THREE.Vector3(1, -phi, 0),
    new THREE.Vector3(0, -1, phi),
    new THREE.Vector3(0, 1, phi),
    new THREE.Vector3(0, -1, -phi),
    new THREE.Vector3(0, 1, -phi),
    new THREE.Vector3(phi, 0, -1),
    new THREE.Vector3(phi, 0, 1),
    new THREE.Vector3(-phi, 0, -1),
    new THREE.Vector3(-phi, 0, 1),
  ] as const;
  const base = positions.length / 3;

  for (const local of localVertices) {
    const normal = local.clone().normalize();
    const x = normal.x * radius;
    const y = normal.y * radius * 1.06;
    const z = normal.z * radius;
    positions.push(center.x + x, center.y + y, center.z + z);
    normals.push(normal.x, normal.y, normal.z);
    uvs.push(0.5, THREE.MathUtils.clamp((center.y + y) / 1.75, 0, 1));
  }

  indices.push(
    base, base + 11, base + 5,
    base, base + 5, base + 1,
    base, base + 1, base + 7,
    base, base + 7, base + 10,
    base, base + 10, base + 11,
    base + 1, base + 5, base + 9,
    base + 5, base + 11, base + 4,
    base + 11, base + 10, base + 2,
    base + 10, base + 7, base + 6,
    base + 7, base + 1, base + 8,
    base + 3, base + 9, base + 4,
    base + 3, base + 4, base + 2,
    base + 3, base + 2, base + 6,
    base + 3, base + 6, base + 8,
    base + 3, base + 8, base + 9,
    base + 4, base + 9, base + 5,
    base + 2, base + 4, base + 11,
    base + 6, base + 2, base + 10,
    base + 8, base + 6, base + 7,
    base + 9, base + 8, base + 1,
  );
}

function hash01(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function createBerryClumpPlacements(
  sites: ReadonlyArray<ForagingSite>,
  rng: () => number,
  isBlockedAt?: (x: number, z: number) => boolean,
): BerryClumpPlacement[] {
  const placements: BerryClumpPlacement[] = [];

  sites.forEach((site, index) => {
    const nodeId = `foraging-berries-${index}`;
    const patch: BerryClumpPlacement[] = [];
    let attempts = 0;

    while (patch.length < CLUMPS_PER_PATCH && attempts < CLUMPS_PER_PATCH * 18) {
      attempts++;
      const radius = patch.length === 0 ? 0 : Math.sqrt(rng()) * PATCH_RADIUS;
      const angle = rng() * TAU;
      const x = site.x + Math.cos(angle) * radius * THREE.MathUtils.lerp(0.72, 1, rng());
      const z = site.z + Math.sin(angle) * radius * THREE.MathUtils.lerp(0.78, 1.08, rng());
      if (isBlockedAt?.(x, z)) continue;
      if (!hasMinimumClumpDistance(patch, x, z, 1.25 + rng() * 0.65)) continue;

      patch.push({
        nodeId,
        x,
        z,
        yaw: rng() * TAU,
        scale: sampleBerryPatchClumpScale(rng),
      });
    }

    placements.push(...patch);
  });

  return placements;
}

function hasMinimumClumpDistance(
  placements: ReadonlyArray<BerryClumpPlacement>,
  x: number,
  z: number,
  minDistance: number,
): boolean {
  const minDistanceSq = minDistance * minDistance;
  return placements.every((placement) => {
    const dx = placement.x - x;
    const dz = placement.z - z;
    return dx * dx + dz * dz >= minDistanceSq;
  });
}
