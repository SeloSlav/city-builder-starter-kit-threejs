import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose.ts';
import type { BuildingState } from '../resources/types.ts';
import type { Terrain } from '../terrain/Terrain.ts';

type BuildingMarkersOptions = {
  terrain: Terrain;
  parent: THREE.Group;
};

export class BuildingMarkers {
  private readonly terrain: Terrain;
  private readonly group = new THREE.Group();
  private readonly buildingMeshes = new Map<string, THREE.Group>();
  private readonly radiusMeshes = new Map<string, THREE.Mesh>();
  private previewMesh: THREE.Mesh | null = null;

  constructor(options: BuildingMarkersOptions) {
    this.terrain = options.terrain;
    this.group.name = 'Building markers';
    options.parent.add(this.group);
  }

  syncBuildings(buildings: Iterable<BuildingState>): void {
    const nextIds = new Set<string>();
    for (const building of buildings) {
      nextIds.add(building.id);
      this.upsertBuilding(building);
    }

    for (const id of this.buildingMeshes.keys()) {
      if (nextIds.has(id)) continue;
      this.removeBuilding(id);
    }
  }

  setPlacementPreview(x: number, z: number, radius: number, visible: boolean): void {
    if (!visible) {
      if (this.previewMesh) this.previewMesh.visible = false;
      return;
    }

    if (!this.previewMesh) {
      this.previewMesh = createRadiusRing(0x84a66b, 0.28);
      this.group.add(this.previewMesh);
    }

    const y = this.terrain.getHeightAt(x, z) + 0.2;
    this.previewMesh.visible = true;
    this.previewMesh.position.set(x, y, z);
    this.previewMesh.scale.set(radius, 1, radius);
  }

  dispose(): void {
    if (this.previewMesh) {
      disposeObject3D(this.previewMesh);
      this.previewMesh = null;
    }
    for (const id of [...this.buildingMeshes.keys()]) {
      this.removeBuilding(id);
    }
    this.group.removeFromParent();
  }

  private upsertBuilding(building: BuildingState): void {
    let marker = this.buildingMeshes.get(building.id);
    if (!marker) {
      marker = createBuildingMarker(building.kind);
      this.buildingMeshes.set(building.id, marker);
      this.group.add(marker);

      const radius = createRadiusRing(building.kind === 'lumber_mill' ? 0xd7b463 : 0x84a66b, 0.16);
      this.radiusMeshes.set(building.id, radius);
      this.group.add(radius);
    }

    const y = this.terrain.getHeightAt(building.x, building.z);
    marker.position.set(building.x, y, building.z);

    const radiusMesh = this.radiusMeshes.get(building.id);
    if (radiusMesh) {
      radiusMesh.position.set(building.x, y + 0.15, building.z);
      radiusMesh.scale.set(building.workRadius, 1, building.workRadius);
    }
  }

  private removeBuilding(id: string): void {
    const marker = this.buildingMeshes.get(id);
    if (marker) {
      disposeObject3D(marker);
      this.buildingMeshes.delete(id);
    }
    const radius = this.radiusMeshes.get(id);
    if (radius) {
      disposeObject3D(radius);
      this.radiusMeshes.delete(id);
    }
  }
}

function createBuildingMarker(kind: BuildingState['kind']): THREE.Group {
  const group = new THREE.Group();
  group.name = `${kind} marker`;

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 2.4, 4.2),
    new THREE.MeshStandardMaterial({
      color: kind === 'lumber_mill' ? 0x8b6a43 : 0x5f7a4a,
      roughness: 0.88,
      metalness: 0,
    }),
  );
  base.position.y = 1.2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 1.8, 4),
    new THREE.MeshStandardMaterial({
      color: kind === 'lumber_mill' ? 0x5a4030 : 0x466038,
      roughness: 0.92,
      metalness: 0,
    }),
  );
  roof.position.y = 2.8;
  roof.rotation.y = Math.PI * 0.25;
  roof.castShadow = true;
  group.add(roof);

  return group;
}

function createRadiusRing(color: number, opacity: number): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.94, 1, 64);
  geometry.rotateX(-Math.PI * 0.5);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 8;
  return mesh;
}
