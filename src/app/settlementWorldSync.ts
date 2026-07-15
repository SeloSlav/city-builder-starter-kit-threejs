import type { DeliveryAgentRenderer } from '../logistics/DeliveryAgentRenderer.ts';
import type { VillagerRenderer } from '../settlement/VillagerRenderer.ts';
import type { RoadNetwork } from '../roads/RoadNetwork.ts';
import type { BackyardGardenMarkers } from '../residences/BackyardGardenMarkers.ts';
import type { ResidenceMarkers } from '../residences/ResidenceMarkers.ts';
import type { FarmFieldMarkers } from '../farming/FarmFieldMarkers.ts';
import type { PastureMarkers } from '../farming/PastureMarkers.ts';
import type { LivestockVisuals } from '../farming/LivestockVisuals.ts';
import type { GameState } from '../resources/types.ts';
import type { CrowdViewState } from '../settlement/crowdView.ts';

export type SettlementWorldSyncTargets = {
  residenceMarkers: ResidenceMarkers | null;
  farmFieldMarkers: FarmFieldMarkers | null;
  pastureMarkers: PastureMarkers | null;
  livestockVisuals: LivestockVisuals | null;
  backyardGardenMarkers: BackyardGardenMarkers | null;
  deliveryAgents: DeliveryAgentRenderer | null;
  villagers: VillagerRenderer | null;
  getHeightAt: (x: number, z: number) => number;
  getRoadNetwork: () => RoadNetwork | null;
};

export function syncSettlementWorld(
  targets: SettlementWorldSyncTargets,
  state: GameState,
): void {
  const { getHeightAt } = targets;
  targets.residenceMarkers?.syncResidences(state.residences.values(), getHeightAt);
  targets.farmFieldMarkers?.syncFields(state.farmFields.values());
  targets.pastureMarkers?.syncPastures(state.pastures.values(), state.livestockHerds);
  targets.livestockVisuals?.sync(state.pastures.values(), state.livestockHerds);
  targets.backyardGardenMarkers?.syncGardens({
    residences: state.residences.values(),
    zones: state.burgageZones.values(),
    gardens: state.backyardGardens,
    getHeightAt,
  });
  targets.deliveryAgents?.syncTrips(state.deliveryTrips.values());
  targets.deliveryAgents?.applyTripStates(state.deliveryTrips.values());
  targets.villagers?.sync({
    residences: state.residences.values(),
    roadNetwork: targets.getRoadNetwork(),
  });
}

export function tickSettlementWorld(
  targets: Pick<SettlementWorldSyncTargets, 'residenceMarkers' | 'backyardGardenMarkers' | 'livestockVisuals' | 'deliveryAgents' | 'villagers'>,
  dt: number,
  view?: CrowdViewState,
  gameState?: Pick<GameState, 'deliveryTrips'>,
): void {
  if (gameState) {
    targets.deliveryAgents?.applyTripStates(gameState.deliveryTrips.values());
  }
  targets.residenceMarkers?.tick(dt);
  targets.backyardGardenMarkers?.tick(dt, view);
  targets.livestockVisuals?.tick(dt, view);
  targets.deliveryAgents?.update(dt, view);
  targets.villagers?.tick(dt, view);
}

export function disposeSettlementWorld(
  targets: SettlementWorldSyncTargets,
): void {
  targets.residenceMarkers?.dispose();
  targets.farmFieldMarkers?.dispose();
  targets.pastureMarkers?.dispose();
  targets.livestockVisuals?.dispose();
  targets.backyardGardenMarkers?.dispose();
  targets.deliveryAgents?.dispose();
  targets.villagers?.dispose();
}
