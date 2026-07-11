import * as THREE from 'three';
import { addMesh } from '../buildingMaterials.ts';
import { addTriangularGableWall } from '../meshPrimitives.ts';
import {
  residenceFacadeMaterial,
  residenceRoofMaterial,
  stoneMaterial,
  timberMaterial,
} from '../buildingMaterials.ts';

const FOLK_ART_RED = new THREE.MeshStandardMaterial({ color: 0xc04a3a, roughness: 0.88, metalness: 0 });
const FOLK_ART_BLUE = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.88, metalness: 0 });
const FOLK_ART_YELLOW = new THREE.MeshStandardMaterial({ color: 0xccb860, roughness: 0.88, metalness: 0 });
const FOLK_ART_GREEN = new THREE.MeshStandardMaterial({ color: 0x4d6b3c, roughness: 0.88, metalness: 0 });

/** Small village chapel — road-linked homes settle faster and resist abandonment longer. */
export function createChapelMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Chapel';

  const width = 5.2;
  const depth = 6.8;
  const stoneHeight = 0.55;
  const wallHeight = 2.85;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const wallTop = stoneHeight + wallHeight;
  const ridgeHeight = 2.45;
  const roofPitch = Math.atan2(ridgeHeight, halfW);
  const slopeLen = halfW / Math.cos(roofPitch) + 0.18;
  const frontZ = halfD - 0.08;
  const wallMaterial = residenceFacadeMaterial('white');
  const roofMaterial = residenceRoofMaterial('red');

  addMesh(
    group,
    new THREE.BoxGeometry(width + 0.42, stoneHeight, depth + 0.42),
    stoneMaterial('light'),
    new THREE.Vector3(0, stoneHeight * 0.5, 0),
  );

  addMesh(
    group,
    new THREE.BoxGeometry(width - 0.24, wallHeight, depth - 0.24),
    wallMaterial,
    new THREE.Vector3(0, stoneHeight + wallHeight * 0.5, 0),
  );

  const doorWidth = 1.05;
  const doorHeight = 2.05;
  addMesh(
    group,
    new THREE.BoxGeometry(doorWidth, doorHeight, 0.12),
    timberMaterial('dark'),
    new THREE.Vector3(0, stoneHeight + doorHeight * 0.5, frontZ),
  );

  const trimY = stoneHeight + doorHeight * 0.5;
  const trimZ = frontZ + 0.04;
  for (const [x, material] of [
    [-0.72, FOLK_ART_RED],
    [-0.24, FOLK_ART_BLUE],
    [0.24, FOLK_ART_YELLOW],
    [0.72, FOLK_ART_GREEN],
  ] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(0.34, 0.34, 0.06),
      material,
      new THREE.Vector3(x, trimY + 0.55, trimZ),
    );
    addMesh(
      group,
      new THREE.BoxGeometry(0.28, 0.28, 0.06),
      material,
      new THREE.Vector3(x, trimY - 0.42, trimZ),
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(doorWidth + 0.16, doorHeight + 0.1, 0.06),
    timberMaterial('weathered'),
    new THREE.Vector3(0, trimY + 0.02, frontZ - 0.03),
  );

  for (const side of [-1, 1] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(slopeLen, 0.12, depth + 0.28),
      roofMaterial,
      new THREE.Vector3(side * halfW * 0.46, wallTop + ridgeHeight * 0.48, 0),
      new THREE.Euler(0, 0, side * -roofPitch),
    );
  }

  const gableThickness = 0.14;
  for (const zSign of [-1, 1] as const) {
    addTriangularGableWall(
      group,
      'z',
      zSign * (halfD - 0.06),
      halfW,
      wallTop,
      ridgeHeight,
      gableThickness,
      wallMaterial,
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(0.14, 0.14, depth - 0.3),
    timberMaterial('dark'),
    new THREE.Vector3(0, wallTop + ridgeHeight, 0),
  );

  const towerSize = 0.95;
  const towerBaseY = wallTop + ridgeHeight * 0.15;
  const towerHeight = 1.75;
  addMesh(
    group,
    new THREE.BoxGeometry(towerSize, towerHeight, towerSize),
    wallMaterial,
    new THREE.Vector3(0, towerBaseY + towerHeight * 0.5, -halfD + 1.35),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(towerSize + 0.12, 0.12, towerSize + 0.12),
    roofMaterial,
    new THREE.Vector3(0, towerBaseY + towerHeight + 0.06, -halfD + 1.35),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.08, 0.55, 0.08),
    timberMaterial('dark'),
    new THREE.Vector3(0, towerBaseY + towerHeight + 0.42, -halfD + 1.35),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.34, 0.08, 0.08),
    timberMaterial('dark'),
    new THREE.Vector3(0, towerBaseY + towerHeight + 0.58, -halfD + 1.35),
  );

  const wallSegmentCount = 7;
  const wallRadius = 4.1;
  for (let i = 0; i < wallSegmentCount; i++) {
    const t = (i / (wallSegmentCount - 1)) - 0.5;
    const angle = t * 0.72;
    const x = Math.sin(angle) * wallRadius;
    const z = frontZ + 1.15 + Math.cos(angle) * 0.55;
    addMesh(
      group,
      new THREE.BoxGeometry(0.72, 0.48, 0.42),
      stoneMaterial(i % 2 === 0 ? 'mid' : 'light'),
      new THREE.Vector3(x, stoneHeight * 0.24, z),
      new THREE.Euler(0, -angle * 0.35, 0),
    );
  }

  return group;
}
