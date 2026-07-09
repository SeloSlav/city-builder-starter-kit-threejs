import * as THREE from 'three';
import { Terrain } from '../terrain/Terrain.ts';
import type { RoadEdge } from './RoadEdge.ts';
import { RoadMaterialFactory } from './RoadMaterialFactory.ts';
import { RoadNetwork } from './RoadNetwork.ts';
import type { RoadNode } from './RoadNode.ts';
import {
  exteriorDirectionAtNode,
  inwardDirectionAtNode,
  ROAD_END_TRIM,
  roadPerpendicular,
} from './roadEndpoint.ts';

export class RoadJunctionBuilder {
  private readonly terrain: Terrain;
  private readonly materials: RoadMaterialFactory;
  constructor(terrain: Terrain, materials: RoadMaterialFactory) {
    this.terrain = terrain;
    this.materials = materials;
  }

  build(network: RoadNetwork): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Road junction and cap patches';
    for (const node of network.nodes.values()) {
      const patch = this.buildNodePatch(node, network);
      if (patch) group.add(patch);
    }
    return group;
  }

  private buildNodePatch(node: RoadNode, network: RoadNetwork): THREE.Group | null {
    const edges = network.getConnectedEdges(node);
    if (edges.length === 0) return null;
    const width = averageWidth(edges);
    const isEndpoint = edges.length === 1;
    const group = new THREE.Group();
    group.name = `Road ${node.junctionType} ${node.id}`;
    group.userData.nodeId = node.id;

    if (isEndpoint) {
      const edge = edges[0];
      const core = this.buildEndpointCap(node, edge, width, false);
      const blend = this.buildEndpointCap(node, edge, width, true);
      core.renderOrder = 13;
      blend.renderOrder = 12;
      group.add(blend, core);
      return group;
    }

    const radius = width * (edges.length === 2 ? 0.78 : 1.08);
    const blendRadius = radius + width * 0.58;
    const directions = edges.map((edge) => inwardDirectionAtNode(edge, node.id));
    const core = this.buildJunctionPatchMesh(node.position, directions, radius, width, false);
    const blend = this.buildJunctionPatchMesh(node.position, directions, blendRadius, width, true);
    core.renderOrder = 13;
    blend.renderOrder = 12;
    group.add(blend, core);
    return group;
  }

  private buildEndpointCap(node: RoadNode, edge: RoadEdge, width: number, blend: boolean): THREE.Mesh {
    const inward = inwardDirectionAtNode(edge, node.id);
    const exterior = exteriorDirectionAtNode(edge, node.id);
    const perp = roadPerpendicular(inward);
    const half = width * 0.5;
    const trim = width * ROAD_END_TRIM;
    const bulge = width * (blend ? 0.62 : 0.56);
    const mouthCenter = node.position.clone().addScaledVector(inward, trim);
    const yOffset = blend ? 0.04 : 0.078;

    const left = mouthCenter.clone().addScaledVector(perp, half);
    const right = mouthCenter.clone().addScaledVector(perp, -half);
    const ring: THREE.Vector3[] = [left];
    const arcCount = blend ? 24 : 20;
    for (let i = 0; i <= arcCount; i++) {
      const t = i / arcCount;
      const angle = -Math.PI * 0.5 + t * Math.PI;
      const offset = exterior
        .clone()
        .multiplyScalar(Math.cos(angle) * bulge)
        .add(perp.clone().multiplyScalar(Math.sin(angle) * bulge));
      ring.push(mouthCenter.clone().add(offset));
    }
    ring.push(right);

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const mouthY = this.terrain.getHeightAt(mouthCenter.x, mouthCenter.z) + yOffset;
    positions.push(mouthCenter.x, mouthY, mouthCenter.z);
    uvs.push(0.5, 0.5);

    for (const point of ring) {
      positions.push(point.x, this.terrain.getHeightAt(point.x, point.z) + yOffset, point.z);
      const localX = point.x - mouthCenter.x;
      const localZ = point.z - mouthCenter.z;
      const dist = Math.hypot(localX, localZ) / Math.max(1, bulge + half);
      const fadeU = blend ? THREE.MathUtils.clamp(1 - dist * 0.88, 0, 1) : 0.5;
      uvs.push(fadeU, 0.5 + localX / Math.max(1, width * 2.2));
    }

    for (let i = 1; i < ring.length; i++) {
      indices.push(0, i, i + 1);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = blend ? this.materials.roadEdge : this.materials.road;
    return new THREE.Mesh(geometry, material);
  }

  private buildJunctionPatchMesh(
    center: THREE.Vector3,
    directions: THREE.Vector3[],
    radius: number,
    width: number,
    blend: boolean,
  ): THREE.Mesh {
    const ring = this.junctionRing(directions, radius, width, blend);
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const centerY = this.terrain.getHeightAt(center.x, center.z) + (blend ? 0.042 : 0.074);
    positions.push(center.x, centerY, center.z);
    uvs.push(1, 0.5);

    for (const local of ring) {
      const x = center.x + local.x;
      const z = center.z + local.y;
      positions.push(x, this.terrain.getHeightAt(x, z) + (blend ? 0.04 : 0.078), z);
      const dist = local.length() / Math.max(1, radius);
      const fadeU = blend ? THREE.MathUtils.clamp(1 - dist * 0.92, 0, 1) : 0.5;
      uvs.push(fadeU, 0.5 + local.x / Math.max(1, radius * 2.4));
    }

    for (let i = 1; i <= ring.length; i++) {
      const next = i === ring.length ? 1 : i + 1;
      indices.push(0, i, next);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = blend ? this.materials.roadEdge : this.materials.road;
    return new THREE.Mesh(geometry, material);
  }

  private junctionRing(directions: THREE.Vector3[], radius: number, width: number, blend: boolean): THREE.Vector2[] {
    const points: Array<{ angle: number; point: THREE.Vector2 }> = [];
    const spread = blend ? 0.78 : 0.49;
    for (let i = 0; i < directions.length; i++) {
      const base = Math.atan2(directions[i].z, directions[i].x);
      for (const offset of [-spread, -spread * 0.35, spread * 0.35, spread]) {
        const angle = base + offset;
        const wobble = 1 + Math.sin((i + 1) * 9.31 + offset * 4.7) * (blend ? 0.12 : 0.06);
        const r = radius + width * (Math.abs(offset) < spread * 0.5 ? 0.28 : 0.05);
        points.push({ angle: normalizeAngle(angle), point: new THREE.Vector2(Math.cos(angle) * r * wobble, Math.sin(angle) * r * wobble) });
      }
    }
    points.sort((a, b) => a.angle - b.angle);
    return points.map((entry) => entry.point);
  }
}

function averageWidth(edges: RoadEdge[]): number {
  return edges.reduce((sum, edge) => sum + edge.width, 0) / Math.max(1, edges.length);
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
