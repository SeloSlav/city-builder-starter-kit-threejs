import * as THREE from 'three';
import type { RoadEdge } from './RoadEdge.ts';

export const ROAD_END_TRIM = 0.5;

export function getEdgePath(edge: RoadEdge): THREE.Vector3[] {
  const sampled = edge.sampledPath;
  const control = edge.controlPoints;
  if (sampled.length >= 2 && control.length >= 2) {
    return sampled.length >= control.length ? sampled : control;
  }
  if (sampled.length >= 2) return sampled;
  if (control.length >= 2) return control;
  return sampled.length > 0 ? sampled : control;
}

export function inwardDirectionAtNode(edge: RoadEdge, nodeId: string): THREE.Vector3 {
  const path = getEdgePath(edge);
  if (path.length < 2) return new THREE.Vector3(1, 0, 0);
  if (edge.startNodeId === nodeId) {
    return new THREE.Vector3(path[1].x - path[0].x, 0, path[1].z - path[0].z).normalize();
  }
  const last = path.length - 1;
  return new THREE.Vector3(path[last - 1].x - path[last].x, 0, path[last - 1].z - path[last].z).normalize();
}

export function exteriorDirectionAtNode(edge: RoadEdge, nodeId: string): THREE.Vector3 {
  return inwardDirectionAtNode(edge, nodeId).multiplyScalar(-1);
}

export function trimPathAtEndpoint(path: THREE.Vector3[], nodeId: string, edge: RoadEdge, width: number): void {
  if (path.length < 2) return;
  const trim = width * ROAD_END_TRIM;
  if (edge.startNodeId === nodeId) {
    path[0].addScaledVector(inwardDirectionAtNode(edge, nodeId), trim);
    return;
  }
  if (edge.endNodeId === nodeId) {
    const last = path.length - 1;
    path[last].addScaledVector(inwardDirectionAtNode(edge, nodeId), trim);
  }
}

export function roadPerpendicular(direction: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(-direction.z, 0, direction.x).normalize();
}
