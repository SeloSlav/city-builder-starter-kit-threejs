import * as THREE from 'three';
import { createTerrainGrassMaterial } from '../terrain/TerrainGrassMaterial.ts';
import { createRoadCoreMaterial, createRoadEdgeMaterial } from './RoadSurfaceMaterial.ts';
import { RoadTextureLoader, type TerrainBlendTextureSet, type TextureSet } from './RoadTextureLoader.ts';
import type { MeshStandardNodeMaterial } from 'three/webgpu';

export class RoadMaterialFactory {
  readonly road!: MeshStandardNodeMaterial;
  readonly roadEdge!: MeshStandardNodeMaterial;
  readonly terrain!: MeshStandardNodeMaterial;
  readonly previewValid: THREE.MeshStandardMaterial;
  readonly previewInvalid: THREE.MeshStandardMaterial;
  readonly selection: THREE.MeshBasicMaterial;
  readonly snap: THREE.MeshBasicMaterial;
  private roadTextures: TextureSet | null = null;
  private terrainBlendTextures: TerrainBlendTextureSet | null = null;

  private constructor() {
    this.previewValid = new THREE.MeshStandardMaterial({
      color: 0xc8c5be,
      emissive: 0x181715,
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.previewInvalid = new THREE.MeshStandardMaterial({
      color: 0x968880,
      emissive: 0x1a1210,
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.selection = new THREE.MeshBasicMaterial({
      color: 0xc8c2b8,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    this.snap = new THREE.MeshBasicMaterial({
      color: 0xb8b0a4,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
  }

  static async create(maxAnisotropy: number): Promise<RoadMaterialFactory> {
    const factory = new RoadMaterialFactory();
    const textureLoader = new RoadTextureLoader(Math.min(maxAnisotropy, 8));
    factory.roadTextures = await textureLoader.loadRoadTextures();
    factory.terrainBlendTextures = await textureLoader.loadTerrainBlendTextures();
    Object.assign(factory, factory.createMaterials());
    return factory;
  }

  dispose(): void {
    const materials = [this.road, this.roadEdge, this.terrain, this.previewValid, this.previewInvalid, this.selection, this.snap];
    materials.forEach((material) => material.dispose());
    if (this.roadTextures) this.disposeTextureSet(this.roadTextures);
    if (this.terrainBlendTextures) {
      this.disposeTextureSet(this.terrainBlendTextures.meadow);
      this.disposeTextureSet(this.terrainBlendTextures.dense);
      this.disposeTextureSet(this.terrainBlendTextures.dry);
    }
  }

  private createMaterials(): { road: MeshStandardNodeMaterial; roadEdge: MeshStandardNodeMaterial; terrain: MeshStandardNodeMaterial } {
    if (!this.roadTextures || !this.terrainBlendTextures) throw new Error('Textures are not loaded.');
    const road = createRoadCoreMaterial(this.roadTextures);
    const roadEdge = createRoadEdgeMaterial(this.roadTextures);
    const terrain = createTerrainGrassMaterial(this.terrainBlendTextures);
    return { road, roadEdge, terrain };
  }

  private disposeTextureSet(set: TextureSet): void {
    Object.values(set).forEach((texture) => texture?.dispose());
  }
}
