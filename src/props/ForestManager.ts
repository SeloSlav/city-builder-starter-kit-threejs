import * as THREE from 'three';
import type { Terrain } from '../terrain/Terrain.ts';
import type { RoadEdge } from '../roads/RoadEdge.ts';
import type { RoadNetwork } from '../roads/RoadNetwork.ts';
import { distancePointToPolylineXZ, type RockObstacle } from '../utils/pathGeometry.ts';
import type { UndergrowthInstances, UndergrowthPlacement } from './ForestUndergrowth.ts';
import {
  computeRoadStumpPlacements,
  createRoadStumpMesh,
  createHarvestStumpMesh,
  isUndergrowthNearAnyEdge,
  updateRoadStumpInstances,
  updateHarvestStumpInstance,
} from './RoadStumps.ts';

const ROAD_CLEAR_MARGIN = 1.35;
const UNDERGROWTH_CLEAR_MARGIN = 0.95;

type TreePlacement = {
  x: number;
  z: number;
  form: 'narrow' | 'broad' | 'young' | 'midstory';
  species: string;
  scale: number;
};

export type ForestTreeLayout = TreePlacement & {
  layoutIndex: number;
};

export type MixedForestInstances = {
  group: THREE.Group;
  trunkMesh: THREE.InstancedMesh;
  coniferFoliageMesh: THREE.InstancedMesh;
  broadleafFoliageMesh: THREE.InstancedMesh;
  coniferShadowMesh: THREE.InstancedMesh;
  broadleafShadowMesh: THREE.InstancedMesh;
  placements: TreePlacement[];
  coniferLayerCounts: number[];
  broadleafLayerCounts: number[];
  coniferStartIndex: number[];
  broadleafStartIndex: number[];
  trunkMatrices: THREE.Matrix4[];
  coniferFoliageMatrices: THREE.Matrix4[];
  broadleafFoliageMatrices: THREE.Matrix4[];
};

export class ForestManager {
  readonly group: THREE.Group;
  readonly rockPlacements: ReadonlyArray<RockObstacle>;
  private readonly disposeResources: () => void;
  private readonly placements: TreePlacement[];
  private readonly trunkMesh: THREE.InstancedMesh;
  private readonly coniferFoliageMesh: THREE.InstancedMesh;
  private readonly broadleafFoliageMesh: THREE.InstancedMesh;
  private readonly coniferShadowMesh: THREE.InstancedMesh;
  private readonly broadleafShadowMesh: THREE.InstancedMesh;
  private readonly coniferLayerCounts: number[];
  private readonly broadleafLayerCounts: number[];
  private readonly coniferStartIndex: number[];
  private readonly broadleafStartIndex: number[];
  private readonly trunkMatrices: THREE.Matrix4[];
  private readonly coniferFoliageMatrices: THREE.Matrix4[];
  private readonly broadleafFoliageMatrices: THREE.Matrix4[];
  private readonly undergrowth: UndergrowthInstances | null;
  private readonly undergrowthPlacements: UndergrowthPlacement[];
  private readonly stumpMesh: THREE.InstancedMesh;
  private readonly harvestStumpMesh: THREE.InstancedMesh;
  private readonly terrain: Terrain;
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratchScale = new THREE.Vector3();
  private readonly scratchPosition = new THREE.Vector3();
  private readonly scratchQuaternion = new THREE.Quaternion();
  private removedTrees = new Set<number>();
  private removedUndergrowth = new Set<number>();
  private treePhases = new Map<number, 'standing' | 'felling' | 'felled' | 'regrowing'>();

  constructor(
    root: THREE.Group,
    forestInstances: MixedForestInstances,
    rockPlacements: ReadonlyArray<RockObstacle>,
    undergrowth: UndergrowthInstances | null,
    undergrowthPlacements: UndergrowthPlacement[],
    terrain: Terrain,
    disposeResources: () => void,
  ) {
    this.group = root;
    this.rockPlacements = rockPlacements;
    this.disposeResources = disposeResources;
    this.placements = forestInstances.placements;
    this.trunkMesh = forestInstances.trunkMesh;
    this.coniferFoliageMesh = forestInstances.coniferFoliageMesh;
    this.broadleafFoliageMesh = forestInstances.broadleafFoliageMesh;
    this.coniferShadowMesh = forestInstances.coniferShadowMesh;
    this.broadleafShadowMesh = forestInstances.broadleafShadowMesh;
    this.coniferLayerCounts = forestInstances.coniferLayerCounts;
    this.broadleafLayerCounts = forestInstances.broadleafLayerCounts;
    this.coniferStartIndex = forestInstances.coniferStartIndex;
    this.broadleafStartIndex = forestInstances.broadleafStartIndex;
    this.trunkMatrices = forestInstances.trunkMatrices;
    this.coniferFoliageMatrices = forestInstances.coniferFoliageMatrices;
    this.broadleafFoliageMatrices = forestInstances.broadleafFoliageMatrices;
    this.undergrowth = undergrowth;
    this.undergrowthPlacements = undergrowthPlacements;
    this.terrain = terrain;
    this.stumpMesh = createRoadStumpMesh();
    this.harvestStumpMesh = createHarvestStumpMesh(this.placements.length);
    this.group.add(this.stumpMesh);
    this.group.add(this.harvestStumpMesh);
    for (let i = 0; i < this.placements.length; i++) {
      this.hideHarvestStump(i);
    }
  }

  getTreeLayouts(): ForestTreeLayout[] {
    return this.placements.map((placement, layoutIndex) => ({
      layoutIndex,
      ...placement,
    }));
  }

  applyTreePhase(
    layoutIndex: number,
    phase: 'standing' | 'felling' | 'felled' | 'regrowing',
    regrowProgress: number,
  ): void {
    if (layoutIndex < 0 || layoutIndex >= this.placements.length) return;
    this.treePhases.set(layoutIndex, phase);

    if (this.removedTrees.has(layoutIndex)) return;

    switch (phase) {
      case 'standing':
        this.hideHarvestStump(layoutIndex);
        this.showTree(layoutIndex);
        break;
      case 'felling':
        this.hideHarvestStump(layoutIndex);
        this.hideTree(layoutIndex);
        break;
      case 'felled':
        this.hideTree(layoutIndex);
        this.showHarvestStump(layoutIndex);
        break;
      case 'regrowing':
        this.hideHarvestStump(layoutIndex);
        this.showTreeWithScale(layoutIndex, 0.18 + regrowProgress * 0.82);
        break;
      default: {
        const unreachable: never = phase;
        return unreachable;
      }
    }
  }

  syncRoadClearance(network: RoadNetwork): void {
    const edges = [...network.edges.values()];
    const nextRemoved = new Set<number>();

    for (let treeIndex = 0; treeIndex < this.placements.length; treeIndex++) {
      if (this.isTreeNearAnyEdge(this.placements[treeIndex], edges)) {
        nextRemoved.add(treeIndex);
      }
    }

    for (let treeIndex = 0; treeIndex < this.placements.length; treeIndex++) {
      const shouldRemove = nextRemoved.has(treeIndex);
      if (shouldRemove === this.removedTrees.has(treeIndex)) continue;
      if (shouldRemove) this.hideTree(treeIndex);
      else this.showTree(treeIndex);
    }

    this.removedTrees = nextRemoved;
    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.coniferFoliageMesh.instanceMatrix.needsUpdate = true;
    this.broadleafFoliageMesh.instanceMatrix.needsUpdate = true;
    this.coniferShadowMesh.instanceMatrix.needsUpdate = true;
    this.broadleafShadowMesh.instanceMatrix.needsUpdate = true;

    this.syncUndergrowthClearance(edges);
    this.syncRoadStumps(network);
  }

  dispose(): void {
    this.stumpMesh.geometry.dispose();
    (this.stumpMesh.material as THREE.Material).dispose();
    this.harvestStumpMesh.geometry.dispose();
    (this.harvestStumpMesh.material as THREE.Material).dispose();
    this.disposeResources();
  }

  private syncUndergrowthClearance(edges: RoadEdge[]): void {
    if (!this.undergrowth) return;

    const nextRemoved = new Set<number>();
    for (let index = 0; index < this.undergrowthPlacements.length; index++) {
      const placement = this.undergrowthPlacements[index];
      if (isUndergrowthNearAnyEdge(placement.x, placement.z, edges, UNDERGROWTH_CLEAR_MARGIN)) {
        nextRemoved.add(index);
      }
    }

    for (let index = 0; index < this.undergrowthPlacements.length; index++) {
      const shouldRemove = nextRemoved.has(index);
      if (shouldRemove === this.removedUndergrowth.has(index)) continue;
      const placement = this.undergrowthPlacements[index];
      const mesh = placement.kind === 'bush' ? this.undergrowth.bushMesh : this.undergrowth.fernMesh;
      const shadowMesh =
        placement.kind === 'bush' ? this.undergrowth.bushShadowMesh : this.undergrowth.fernShadowMesh;
      const matrices = placement.kind === 'bush' ? this.undergrowth.bushMatrices : this.undergrowth.fernMatrices;
      const matrix = shouldRemove ? this.hiddenMatrix : matrices[placement.meshIndex];
      mesh.setMatrixAt(placement.meshIndex, matrix);
      shadowMesh.setMatrixAt(placement.meshIndex, matrix);
    }

    this.removedUndergrowth = nextRemoved;
    this.undergrowth.bushMesh.instanceMatrix.needsUpdate = true;
    this.undergrowth.fernMesh.instanceMatrix.needsUpdate = true;
    this.undergrowth.bushShadowMesh.instanceMatrix.needsUpdate = true;
    this.undergrowth.fernShadowMesh.instanceMatrix.needsUpdate = true;
  }

  private syncRoadStumps(network: RoadNetwork): void {
    const placements = computeRoadStumpPlacements(network);
    updateRoadStumpInstances(this.stumpMesh, placements, this.terrain);
  }

  private isTreeNearAnyEdge(placement: TreePlacement, edges: RoadEdge[]): boolean {
    for (const edge of edges) {
      const path = edge.sampledPath.length >= 2 ? edge.sampledPath : edge.controlPoints;
      if (path.length < 2) continue;
      const distance = distancePointToPolylineXZ(placement.x, placement.z, path);
      if (distance <= treeClearRadius(placement, edge.width)) return true;
    }
    return false;
  }

  private hideTree(treeIndex: number): void {
    this.trunkMesh.setMatrixAt(treeIndex, this.hiddenMatrix);
    this.hideConiferLayers(treeIndex);
    this.hideBroadleafLayers(treeIndex);
  }

  private showTree(treeIndex: number): void {
    this.showTreeWithScale(treeIndex, 1);
  }

  private showTreeWithScale(treeIndex: number, scaleFactor: number): void {
    this.trunkMesh.setMatrixAt(
      treeIndex,
      this.scaledTreeMatrix(this.trunkMatrices[treeIndex], scaleFactor).clone(),
    );
    this.showConiferLayers(treeIndex, scaleFactor);
    this.showBroadleafLayers(treeIndex, scaleFactor);
    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.coniferFoliageMesh.instanceMatrix.needsUpdate = true;
    this.broadleafFoliageMesh.instanceMatrix.needsUpdate = true;
    this.coniferShadowMesh.instanceMatrix.needsUpdate = true;
    this.broadleafShadowMesh.instanceMatrix.needsUpdate = true;
  }

  private scaledTreeMatrix(baseMatrix: THREE.Matrix4, scaleFactor: number): THREE.Matrix4 {
    this.scratchMatrix.copy(baseMatrix);
    this.scratchMatrix.decompose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
    this.scratchScale.multiplyScalar(scaleFactor);
    this.scratchMatrix.compose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
    return this.scratchMatrix;
  }

  private showHarvestStump(layoutIndex: number): void {
    const placement = this.placements[layoutIndex];
    updateHarvestStumpInstance(
      this.harvestStumpMesh,
      layoutIndex,
      placement.x,
      placement.z,
      this.terrain.getHeightAt(placement.x, placement.z),
      placement.scale,
    );
  }

  private hideHarvestStump(layoutIndex: number): void {
    this.harvestStumpMesh.setMatrixAt(layoutIndex, this.hiddenMatrix);
    this.harvestStumpMesh.instanceMatrix.needsUpdate = true;
  }

  private hideConiferLayers(treeIndex: number): void {
    const foliageStart = this.coniferStartIndex[treeIndex];
    const foliageCount = this.coniferLayerCounts[treeIndex];
    for (let i = 0; i < foliageCount; i++) {
      const layerIndex = foliageStart + i;
      this.coniferFoliageMesh.setMatrixAt(layerIndex, this.hiddenMatrix);
      this.coniferShadowMesh.setMatrixAt(layerIndex, this.hiddenMatrix);
    }
  }

  private showConiferLayers(treeIndex: number, scaleFactor = 1): void {
    const foliageStart = this.coniferStartIndex[treeIndex];
    const foliageCount = this.coniferLayerCounts[treeIndex];
    for (let i = 0; i < foliageCount; i++) {
      const layerIndex = foliageStart + i;
      const matrix = this.scaledTreeMatrix(this.coniferFoliageMatrices[layerIndex], scaleFactor).clone();
      this.coniferFoliageMesh.setMatrixAt(layerIndex, matrix);
      this.coniferShadowMesh.setMatrixAt(layerIndex, matrix);
    }
  }

  private hideBroadleafLayers(treeIndex: number): void {
    const foliageStart = this.broadleafStartIndex[treeIndex];
    const foliageCount = this.broadleafLayerCounts[treeIndex];
    for (let i = 0; i < foliageCount; i++) {
      const layerIndex = foliageStart + i;
      this.broadleafFoliageMesh.setMatrixAt(layerIndex, this.hiddenMatrix);
      this.broadleafShadowMesh.setMatrixAt(layerIndex, this.hiddenMatrix);
    }
  }

  private showBroadleafLayers(treeIndex: number, scaleFactor = 1): void {
    const foliageStart = this.broadleafStartIndex[treeIndex];
    const foliageCount = this.broadleafLayerCounts[treeIndex];
    for (let i = 0; i < foliageCount; i++) {
      const layerIndex = foliageStart + i;
      const matrix = this.scaledTreeMatrix(this.broadleafFoliageMatrices[layerIndex], scaleFactor).clone();
      this.broadleafFoliageMesh.setMatrixAt(layerIndex, matrix);
      this.broadleafShadowMesh.setMatrixAt(layerIndex, matrix);
    }
  }
}

function treeClearRadius(placement: TreePlacement, roadWidth: number): number {
  const canopyRadius =
    placement.form === 'broad'
      ? 4.1 * placement.scale
      : placement.form === 'young' || placement.form === 'midstory'
        ? 2.3 * placement.scale
        : 3.3 * placement.scale;
  return roadWidth * 0.5 + canopyRadius + ROAD_CLEAR_MARGIN;
}
