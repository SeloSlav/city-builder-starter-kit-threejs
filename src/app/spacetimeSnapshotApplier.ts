import type { BuildingMarkers } from '../buildings/BuildingMarkers.ts';
import type { BurgageFencing } from '../residences/BurgageFencing.ts';
import type { ForestVisualSync } from '../resources/ForestVisualSync.ts';
import type { GameState } from '../resources/types.ts';
import type { SceneManager } from '../scene/SceneManager.ts';
import { collectOccupiedParcelPolygons } from '../residences/burgageZoneLayout.ts';
import { syncSettlementWorld, type SettlementWorldSyncTargets } from './settlementWorldSync.ts';
import {
  collectPlacedBuildingSources,
  getForestClearanceSignature,
  getPlacedBuildingSignature,
  syncPlacedBuildingTerrain,
} from './placedBuildingTerrainSync.ts';

export type SpacetimeSnapshotApplierDeps = {
  sceneManager: SceneManager | null;
  buildingMarkers: BuildingMarkers | null;
  burgageFencing: BurgageFencing | null;
  forestVisualSync: ForestVisualSync | null;
  settlementWorld: SettlementWorldSyncTargets;
  onForestClearanceChanged?: () => void;
};

export class SpacetimeSnapshotApplier {
  private lastPlacedBuildingSignature = '';
  private lastForestClearanceSignature = '';
  private readonly previousTreePhases = new Map<string, string>();
  private readonly previousTreeGrowth = new Map<string, number>();

  apply(
    deps: SpacetimeSnapshotApplierDeps,
    state: GameState,
    previous: GameState | null,
  ): void {
    const previousTreeCount = previous?.trees.size ?? 0;
    const changedTreeIds: string[] = [];
    for (const [treeId, entity] of state.trees) {
      const previousPhase = this.previousTreePhases.get(treeId);
      const previousGrowth = this.previousTreeGrowth.get(treeId);
      const phaseChanged = previousPhase !== entity.phase || previousPhase === undefined;
      const growthChanged = previousGrowth !== entity.growthProgress;
      if (phaseChanged || growthChanged) {
        changedTreeIds.push(treeId);
      }
      this.previousTreePhases.set(treeId, entity.phase);
      this.previousTreeGrowth.set(treeId, entity.growthProgress);
    }

    if (deps.forestVisualSync && state.trees.size > 0 && previousTreeCount === 0) {
      deps.forestVisualSync.syncAll(state.trees);
    } else if (changedTreeIds.length > 0) {
      deps.forestVisualSync?.syncTrees(state.trees, changedTreeIds);
    }

    const buildingSignature = getPlacedBuildingSignature(state.buildings);
    if (buildingSignature !== this.lastPlacedBuildingSignature) {
      this.lastPlacedBuildingSignature = buildingSignature;
      deps.buildingMarkers?.syncBuildings(state.buildings.values());
      syncPlacedBuildingTerrain({
        sceneManager: deps.sceneManager,
        gameState: state,
        buildingMarkers: deps.buildingMarkers,
        forceMeshUpdate: true,
        onSignatureUpdate: (signature) => {
          this.lastPlacedBuildingSignature = signature;
        },
      });
    }

    syncSettlementWorld(deps.settlementWorld, state);
    deps.burgageFencing?.syncZones(
      state.burgageZones.values(),
      state.residences.values(),
      (x, z) => deps.sceneManager?.terrain.getHeightAt(x, z) ?? 0,
    );

    const forestSignature = getForestClearanceSignature(state);
    if (forestSignature !== this.lastForestClearanceSignature) {
      this.lastForestClearanceSignature = forestSignature;
      deps.onForestClearanceChanged?.();
    }
  }

  syncForestClearance(deps: SpacetimeSnapshotApplierDeps, gameState: GameState): void {
    if (!deps.sceneManager) return;
    deps.sceneManager.setForestClearanceSources(
      collectPlacedBuildingSources(gameState),
      collectOccupiedParcelPolygons(gameState.burgageZones.values(), gameState.residences.values()),
    );
  }

  reset(): void {
    this.lastPlacedBuildingSignature = '';
    this.lastForestClearanceSignature = '';
    this.previousTreePhases.clear();
    this.previousTreeGrowth.clear();
  }
}
