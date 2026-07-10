import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose.ts';
import { RoadMaterialFactory } from './RoadMaterialFactory.ts';
import { RoadMeshBuilder } from './RoadMeshBuilder.ts';

const MAX_ANCHOR_MARKERS = 16;

function pathSignature(points: THREE.Vector3[], valid: boolean, width: number, snapPoint: THREE.Vector3 | null): string {
  const pointPart = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)},${point.z.toFixed(2)}`).join('|');
  const snapPart = snapPoint ? `${snapPoint.x.toFixed(2)},${snapPoint.z.toFixed(2)}` : 'none';
  return `${pointPart}|${valid ? 1 : 0}|${width.toFixed(2)}|${snapPart}`;
}

export class RoadPreview {
  private readonly meshBuilder: RoadMeshBuilder;
  readonly group = new THREE.Group();
  private previewMesh: THREE.Mesh | null = null;
  private readonly marker: THREE.Mesh;
  private readonly anchorMarkers: THREE.InstancedMesh;
  private readonly anchorMaterialValid: THREE.MeshBasicMaterial;
  private readonly anchorMaterialInvalid: THREE.MeshBasicMaterial;
  private lastSignature = '';

  constructor(meshBuilder: RoadMeshBuilder, materials: RoadMaterialFactory) {
    this.meshBuilder = meshBuilder;
    this.group.name = 'Road preview';
    this.marker = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.55, 40), materials.snap);
    this.marker.name = 'Snap marker';
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.marker.renderOrder = 30;
    this.anchorMaterialValid = new THREE.MeshBasicMaterial({ color: 0xb0a89e, depthWrite: false });
    this.anchorMaterialInvalid = new THREE.MeshBasicMaterial({ color: 0xcc4444, depthWrite: false });
    this.anchorMarkers = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.45, 8, 8),
      this.anchorMaterialValid,
      MAX_ANCHOR_MARKERS,
    );
    this.anchorMarkers.renderOrder = 31;
    this.group.add(this.marker, this.anchorMarkers);
  }

  update(points: THREE.Vector3[], valid: boolean, width: number, snapPoint: THREE.Vector3 | null, anchorPoints = points): void {
    const signature = pathSignature(points, valid, width, snapPoint);
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      if (this.previewMesh) {
        this.group.remove(this.previewMesh);
        disposeObject3D(this.previewMesh);
        this.previewMesh = null;
      }
      const mesh = this.meshBuilder.buildPreview(points, width, valid);
      if (mesh) {
        mesh.renderOrder = 25;
        this.previewMesh = mesh;
        this.group.add(mesh);
      }
      this.updateAnchors(anchorPoints, valid);
    }

    if (snapPoint) {
      this.marker.visible = true;
      this.marker.position.set(snapPoint.x, snapPoint.y + 0.22, snapPoint.z);
    } else {
      this.marker.visible = false;
    }
  }

  clear(): void {
    this.lastSignature = '';
    if (this.previewMesh) {
      this.group.remove(this.previewMesh);
      disposeObject3D(this.previewMesh);
      this.previewMesh = null;
    }
    this.marker.visible = false;
    this.anchorMarkers.count = 0;
    this.anchorMarkers.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.clear();
    this.marker.geometry.dispose();
    this.anchorMarkers.geometry.dispose();
    this.anchorMaterialValid.dispose();
    this.anchorMaterialInvalid.dispose();
  }

  private updateAnchors(points: THREE.Vector3[], valid: boolean): void {
    this.anchorMarkers.material = valid ? this.anchorMaterialValid : this.anchorMaterialInvalid;
    const step = Math.max(1, Math.floor(points.length / MAX_ANCHOR_MARKERS));
    const matrix = new THREE.Matrix4();
    let count = 0;
    for (let i = 0; i < points.length && count < MAX_ANCHOR_MARKERS; i += step) {
      const point = points[i];
      matrix.identity();
      matrix.setPosition(point.x, point.y + 0.32, point.z);
      this.anchorMarkers.setMatrixAt(count, matrix);
      count += 1;
    }
    this.anchorMarkers.count = count;
    this.anchorMarkers.instanceMatrix.needsUpdate = count > 0;
  }
}
