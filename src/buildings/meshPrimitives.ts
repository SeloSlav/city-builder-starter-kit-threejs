import * as THREE from 'three';
import { addMesh } from './buildingMaterials.ts';

export type GableAxis = 'x' | 'z';

/** Solid triangular infill closing the gable void between the wall plate and ridge. */
export function addTriangularGableWall(
  group: THREE.Group,
  axis: GableAxis,
  planePos: number,
  halfSpan: number,
  wallTop: number,
  ridgeHeight: number,
  thickness: number,
  material: THREE.Material,
  outwardSign: -1 | 0 | 1 = 0,
  centerX = 0,
  centerZ = 0,
): void {
  const span = halfSpan - (outwardSign === 0 ? 0.06 : 0.14);
  const shape = new THREE.Shape();
  shape.moveTo(-span, 0);
  shape.lineTo(span, 0);
  shape.lineTo(0, ridgeHeight);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, wallTop, 0);

  if (axis === 'x') {
    geometry.rotateY(Math.PI * 0.5);
    geometry.translate(centerX + planePos + outwardSign * thickness * 0.5, 0, centerZ);
  } else {
    geometry.translate(centerX, 0, centerZ + planePos + outwardSign * thickness * 0.5);
  }

  addMesh(group, geometry, material, new THREE.Vector3(0, 0, 0));
}
