import * as THREE from 'three';
import { addMesh } from '../buildingMaterials.ts';
import { stoneMaterial, timberMaterial } from '../buildingMaterials.ts';

const MARKET_AWN_RED = new THREE.MeshStandardMaterial({ color: 0xb8423a, roughness: 0.9, metalness: 0 });
const MARKET_AWN_CREAM = new THREE.MeshStandardMaterial({ color: 0xd8c48a, roughness: 0.9, metalness: 0 });
const MARKET_CANOPY = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.88, metalness: 0 });

/** Village marketplace — trade hub; homes need a road link here to sell backyard goods. */
export function createMarketplaceMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Marketplace';

  const width = 7.4;
  const depth = 5.6;
  const stoneHeight = 0.22;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const postHeight = 2.65;
  const awningHeight = 2.35;

  addMesh(
    group,
    new THREE.BoxGeometry(width + 0.5, stoneHeight, depth + 0.5),
    stoneMaterial('light'),
    new THREE.Vector3(0, stoneHeight * 0.5, 0),
  );

  for (const [x, z] of [
    [-halfW + 0.35, -halfD + 0.35],
    [halfW - 0.35, -halfD + 0.35],
    [-halfW + 0.35, halfD - 0.35],
    [halfW - 0.35, halfD - 0.35],
  ] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(0.22, postHeight, 0.22),
      timberMaterial('dark'),
      new THREE.Vector3(x, stoneHeight + postHeight * 0.5, z),
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(width - 0.5, 0.1, 0.18),
    timberMaterial('weathered'),
    new THREE.Vector3(0, stoneHeight + awningHeight, halfD - 0.12),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(width - 0.5, 0.1, 0.18),
    timberMaterial('weathered'),
    new THREE.Vector3(0, stoneHeight + awningHeight, -halfD + 0.12),
  );

  const awningPanelCount = 6;
  const panelWidth = (width - 0.8) / awningPanelCount;
  for (let i = 0; i < awningPanelCount; i++) {
    const x = -halfW + 0.55 + panelWidth * (i + 0.5);
    const material = i % 2 === 0 ? MARKET_AWN_RED : MARKET_AWN_CREAM;
    addMesh(
      group,
      new THREE.BoxGeometry(panelWidth * 0.92, 0.06, depth - 0.55),
      material,
      new THREE.Vector3(x, stoneHeight + awningHeight + 0.04, 0),
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(width - 0.7, 0.08, depth - 0.7),
    MARKET_CANOPY,
    new THREE.Vector3(0, stoneHeight + awningHeight - 0.12, 0),
  );

  for (const [x, crateMaterial] of [
    [-2.1, timberMaterial('weathered')],
    [-0.7, timberMaterial('mid')],
    [0.9, timberMaterial('light')],
    [2.2, timberMaterial('weathered')],
  ] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(0.95, 0.62, 0.72),
      crateMaterial,
      new THREE.Vector3(x, stoneHeight + 0.31, -0.35),
    );
    addMesh(
      group,
      new THREE.BoxGeometry(0.42, 0.48, 0.42),
      stoneMaterial('mid'),
      new THREE.Vector3(x + 0.28, stoneHeight + 0.24, 0.55),
    );
  }

  addMesh(
    group,
    new THREE.CylinderGeometry(0.34, 0.38, 0.55, 10),
    timberMaterial('dark'),
    new THREE.Vector3(-2.55, stoneHeight + 0.28, 1.05),
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.34, 0.38, 0.55, 10),
    timberMaterial('dark'),
    new THREE.Vector3(2.45, stoneHeight + 0.28, 1.05),
  );

  addMesh(
    group,
    new THREE.BoxGeometry(1.35, 0.9, 0.55),
    timberMaterial('mid'),
    new THREE.Vector3(0, stoneHeight + 0.45, halfD - 0.55),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.05, 0.72, 0.08),
    timberMaterial('dark'),
    new THREE.Vector3(0, stoneHeight + 0.36, halfD - 0.18),
  );

  for (const side of [-1, 1] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(0.14, 0.14, depth - 0.4),
      timberMaterial('dark'),
      new THREE.Vector3(side * (halfW - 0.1), stoneHeight + awningHeight, 0),
    );
  }

  return group;
}
