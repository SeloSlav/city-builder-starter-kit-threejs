import * as THREE from 'three';
import type { MeshStandardNodeMaterial } from 'three/webgpu';
import type { Terrain } from '../terrain/Terrain.ts';
import type { RiverLayout, RiverPoint } from './RiverLayout.ts';
import { hashF64 } from './riverHash.ts';

const TAU = Math.PI * 2;
const LAKE_SHORE_RADIUS = 54;
const Y_OFFSET = 0.048;

export function createRiverBankMeshes(
  terrain: Terrain,
  layout: RiverLayout,
  material: MeshStandardNodeMaterial,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'River banks';

  layout.corridors.forEach((corridor, index) => {
    if (corridor.points.length < 2) return;
    const mesh = buildCorridorBankRibbon(terrain, corridor.points, `river-${index}`, material);
    mesh.name = `River bank corridor ${index}`;
    mesh.renderOrder = 9;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
  });

  const lakeMesh = buildLakeBankRing(terrain, layout.drain, layout.seed, material);
  lakeMesh.name = 'River bank lake shore';
  lakeMesh.renderOrder = 9;
  lakeMesh.receiveShadow = true;
  lakeMesh.castShadow = false;
  group.add(lakeMesh);

  return group;
}

function buildCorridorBankRibbon(
  terrain: Terrain,
  points: RiverPoint[],
  seed: string,
  material: MeshStandardNodeMaterial,
): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const distances = cumulativeDistances(points);
  const seedValue = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const center = terrain.getPointAt(point.x, point.z, 0);
    const tangent = tangentAt(points, i);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const bankWidth = THREE.MathUtils.lerp(4.8, 7.8, THREE.MathUtils.clamp(point.halfWidth / 22, 0, 1));
    const shoulderMid = bankWidth * 0.48;
    const shoulderOuter = bankWidth * 0.94;
    const innerInset = Math.min(0.55, point.halfWidth * 0.06);
    const leftJitter = bankJitter(seedValue, i, 0) * 0.42;
    const rightJitter = bankJitter(seedValue, i, 1) * 0.42;

    const leftOuter = center.clone().addScaledVector(normal, point.halfWidth + shoulderOuter + leftJitter);
    const leftMid = center.clone().addScaledVector(normal, point.halfWidth + shoulderMid + leftJitter * 0.62);
    const leftInner = center.clone().addScaledVector(normal, point.halfWidth - innerInset + leftJitter * 0.28);
    const rightInner = center.clone().addScaledVector(normal, -point.halfWidth + innerInset + rightJitter * 0.28);
    const rightMid = center.clone().addScaledVector(normal, -point.halfWidth - shoulderMid + rightJitter * 0.62);
    const rightOuter = center.clone().addScaledVector(normal, -point.halfWidth - shoulderOuter + rightJitter);

    for (const p of [leftOuter, leftMid, leftInner, rightInner, rightMid, rightOuter]) {
      p.y = terrain.getHeightAt(p.x, p.z) + Y_OFFSET;
      positions.push(p.x, p.y, p.z);
    }

    const v = distances[i] / 5.4;
    uvs.push(0, v, 0.42, v, 1, v, 1, v, 0.42, v, 0, v);
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 6;
    indices.push(a, a + 6, a + 1, a + 1, a + 6, a + 7);
    indices.push(a + 1, a + 7, a + 2, a + 2, a + 7, a + 8);
    indices.push(a + 3, a + 9, a + 4, a + 4, a + 9, a + 10);
    indices.push(a + 4, a + 10, a + 5, a + 5, a + 10, a + 11);
  }

  return createMesh(positions, uvs, indices, material);
}

function buildLakeBankRing(
  terrain: Terrain,
  drain: { x: number; z: number },
  seed: number,
  material: MeshStandardNodeMaterial,
): THREE.Mesh {
  const sampleCount = 72;
  const ringPoints: Array<{ x: number; z: number; halfWidth: number }> = [];

  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * TAU;
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);
    const shoreNoise =
      (hashF64(seed ^ 0x5151, Math.floor(nx * 40), Math.floor(nz * 40)) - 0.5) * 7 +
      (hashF64(seed ^ 0x9393, i, 3) - 0.5) * 3.5;
    const radius = LAKE_SHORE_RADIUS + shoreNoise;
    ringPoints.push({
      x: drain.x + nx * radius,
      z: drain.z + nz * radius,
      halfWidth: 0,
    });
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const bankWidth = 6.4;
  const shoulderMid = bankWidth * 0.48;
  const shoulderOuter = bankWidth * 0.94;
  const distances = cumulativeDistances(ringPoints);

  for (let i = 0; i < ringPoints.length; i++) {
    const point = ringPoints[i];
    const prev = ringPoints[(i - 1 + ringPoints.length) % ringPoints.length];
    const next = ringPoints[(i + 1) % ringPoints.length];
    const tangent = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z).normalize();
    const outward = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const center = terrain.getPointAt(point.x, point.z, 0);
    const jitter = bankJitter(seed, i, 2) * 0.36;

    const outer = center.clone().addScaledVector(outward, shoulderOuter + jitter);
    const mid = center.clone().addScaledVector(outward, shoulderMid + jitter * 0.62);
    const inner = center.clone().addScaledVector(outward, -0.35 + jitter * 0.2);

    for (const p of [outer, mid, inner]) {
      p.y = terrain.getHeightAt(p.x, p.z) + Y_OFFSET;
      positions.push(p.x, p.y, p.z);
    }

    const v = distances[i] / 5.4;
    uvs.push(0, v, 0.42, v, 1, v);
  }

  const stride = 3;
  for (let i = 0; i < ringPoints.length; i++) {
    const next = (i + 1) % ringPoints.length;
    const a = i * stride;
    const b = next * stride;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
    indices.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }

  return createMesh(positions, uvs, indices, material);
}

function createMesh(
  positions: number[],
  uvs: number[],
  indices: number[],
  material: MeshStandardNodeMaterial,
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

function tangentAt(points: Array<{ x: number; z: number }>, index: number): THREE.Vector3 {
  const prev = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const tangent = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z);
  if (tangent.lengthSq() < 1e-6) return new THREE.Vector3(1, 0, 0);
  return tangent.normalize();
}

function cumulativeDistances(points: Array<{ x: number; z: number }>): number[] {
  const result = [0];
  for (let i = 1; i < points.length; i++) {
    result.push(
      result[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z),
    );
  }
  return result;
}

function bankJitter(seed: number, index: number, side: number): number {
  return (
    Math.sin(index * 1.734 + side * 11.91 + seed * 0.137) * 0.65 +
    Math.sin(index * 0.431 + seed) * 0.35
  );
}
