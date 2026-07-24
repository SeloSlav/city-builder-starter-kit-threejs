import { getBuildingCost } from '../buildingEconomy.ts';
import { getBuildingDefinition } from '../buildings.ts';
import { laborScaledInterval } from '../resourceTotals.ts';
import type { BuildingKind, InspectableTarget } from '../types.ts';
import {
  buildingCostRows,
  buildingDemolishHint,
  buildingLaborView,
  buildingRoadAccessRow,
  buildingStorageRows,
  buildingExtentRow,
} from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';
import { formatTripDestinationLabel, formatTripPhaseLabel } from '../../logistics/deliveryTrips.ts';
import {
  formatDeliveryRoadDistance,
  formatDeliveryTripDuration,
} from '../../logistics/deliveryLogistics.ts';
import {
  foodLaborSplit,
  foodPerDelivery,
  formatFoodCrewSplit,
  formatFoodRunwayDays,
  residenceFoodRunwayDays,
} from '../../logistics/foodLogistics.ts';
import { formatCooldown } from './woodcuttersLodgeStatus.ts';
import { gameClock } from '../../world/gameCalendar.ts';
import { isForagingHarvestAvailable } from '../../foraging/foragingSeason.ts';

type HarvestBuildingKind = Extract<BuildingKind, 'foragers_shed' | 'hunters_hall' | 'fishing_camp'>;
type HarvestForagingKind = 'berries' | 'mushrooms' | 'game' | 'fish';

const HARVEST_BUILDING_COPY: Record<
  HarvestBuildingKind,
  { foragingKind: HarvestForagingKind | readonly HarvestForagingKind[]; idleLabel: string; activeUnit: string; patchLabel: string }
> = {
  foragers_shed: {
    foragingKind: ['berries', 'mushrooms'],
    idleLabel: 'Idle — assign labor to gather wild food',
    activeUnit: 'berries or mushrooms',
    patchLabel: 'wild patch',
  },
  hunters_hall: {
    foragingKind: 'game',
    idleLabel: 'Idle — assign labor to hunt game',
    activeUnit: 'game',
    patchLabel: 'trail',
  },
  fishing_camp: {
    foragingKind: 'fish',
    idleLabel: 'Idle - assign labor to fish the shoal',
    activeUnit: 'fish',
    patchLabel: 'shoal',
  },
};

function formatNextFoodTargetLabel(
  target: ReturnType<InspectorRenderContext['worldQueries']['getNextFoodDeliveryTargetForSupplier']>,
): string {
  if (!target) return 'None needing food';
  const runwayDays = residenceFoodRunwayDays(target);
  const runwaySuffix = runwayDays != null ? ` (${formatFoodRunwayDays(runwayDays)} left)` : '';
  return `Parcel #${target.parcelIndex + 1}${runwaySuffix}`;
}

export function renderHarvestBuildingInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building } = target;
  const copy = HARVEST_BUILDING_COPY[building.kind as HarvestBuildingKind];
  const label = context.worldQueries.getBuildingLabel(building.kind);
  const cost = getBuildingCost(building.kind);
  const definition = getBuildingDefinition(building.kind);
  const nearestNode = context.worldQueries.findNearestForagingWithRemaining(
    building.x,
    building.z,
    building.workRadius,
    copy.foragingKind,
    true,
  );
  const month = gameClock(context.gameState.tick).month;
  const seasonAvailable = nearestNode
    ? isForagingHarvestAvailable(nearestNode.kind as HarvestForagingKind, month)
    : true;
  const crew = foodLaborSplit(building.assignedLabor);
  const claimedResidences = context.worldQueries.getClaimedResidencesForFoodSupplier(building);
  const nextDeliveryTarget = context.worldQueries.getNextFoodDeliveryTargetForSupplier(building);
  const nextTargetLabel = formatNextFoodTargetLabel(nextDeliveryTarget);
  const roadAccess = context.worldQueries.getRoadAccessLabel(building.x, building.z);
  const onRoad = roadAccess.startsWith('Connected');
  const deliveryTripSeconds = context.worldQueries.getFoodDeliveryTripSeconds(building, nextDeliveryTarget);
  const deliveryDistance = nextDeliveryTarget
    ? context.worldQueries.getRoadPathDistance(building.x, building.z, nextDeliveryTarget.x, nextDeliveryTarget.z)
    : null;
  const foodPerTrip = foodPerDelivery(crew.delivering);
  const activeTrip = context.worldQueries.getActiveDeliveryTrip(building);
  const tripRemaining = context.worldQueries.getActiveTripRemainingSeconds(building);
  const harvesting = building.assignedLabor > 0
    && nearestNode != null
    && nearestNode.remaining > 0
    && seasonAvailable;
  const canDeliver = crew.delivering > 0 && onRoad && building.food > 0 && nextDeliveryTarget != null && !activeTrip;
  const cycleSeconds = laborScaledInterval(definition.harvestInterval, building.assignedLabor);

  let statusText: string;
  let statusState: InspectorView['statusState'];
  if (building.assignedLabor === 0) {
    statusText = copy.idleLabel;
    statusState = 'idle';
  } else if (!onRoad && crew.delivering > 0) {
    statusText = 'Off road — connect to the road network for deliveries';
    statusState = 'warning';
  } else if (activeTrip) {
    statusText = `Deliverer ${formatTripPhaseLabel(activeTrip.phase).toLowerCase()} — ${formatCooldown(tripRemaining ?? Infinity)} remaining → ${nextTargetLabel}`;
    statusState = 'active';
  } else if (canDeliver) {
    statusText = `Delivering food — ${claimedResidences.length} road-linked home${claimedResidences.length === 1 ? '' : 's'}`;
    statusState = 'active';
  } else if (nearestNode && !seasonAvailable) {
    statusText = nearestNode.kind === 'fish'
      ? 'Idle — the shoal is frozen until spring'
      : 'Idle — seasonal forage is dormant for winter';
    statusState = 'idle';
  } else if (nearestNode && nearestNode.remaining <= 0) {
    statusText = nearestNode.kind === 'fish'
      ? 'Idle — the shoal is extinct'
      : nearestNode.kind === 'game'
        ? 'Idle — the game habitat is extinct'
        : 'Idle — the patch is empty and waiting for spring or summer regrowth';
    statusState = nearestNode.kind === 'fish' || nearestNode.kind === 'game'
      ? 'warning'
      : 'idle';
  } else if (
    nearestNode?.kind === 'game'
    && nearestNode.remaining < 2
  ) {
    statusText = `Warning — ${nearestNode.remaining.toFixed(1)} animal left, below the breeding floor`;
    statusState = 'warning';
  } else if (harvesting) {
    const resourceLabel = nearestNode.kind === 'mushrooms' ? 'mushrooms' : copy.activeUnit;
    statusText = `Working — ${Math.round(nearestNode.remaining)} ${resourceLabel} left at ${copy.patchLabel}`;
    statusState = 'active';
  } else if (nearestNode) {
    statusText = `Idle — ${Math.round(nearestNode.remaining)} ${copy.activeUnit} in range`;
    statusState = 'idle';
  } else {
    statusText = `Idle — no ${copy.activeUnit} in range`;
    statusState = 'idle';
  }

  const deliveryRow = crew.delivering > 0
    ? `<li><span>Next delivery</span><span>${formatTripDestinationLabel(activeTrip, (id) => context.worldQueries.getResidence(id), nextTargetLabel)}</span></li>
      <li><span>Road distance</span><span>${formatDeliveryRoadDistance(deliveryDistance)}</span></li>
      <li><span>Delivery timer</span><span>${activeTrip ? `${formatTripPhaseLabel(activeTrip.phase)} — ${formatCooldown(tripRemaining ?? Infinity)} left` : `Ready / ${formatDeliveryTripDuration(deliveryTripSeconds)}`}</span></li>
      <li><span>Food per trip</span><span>${foodPerTrip}</span></li>`
    : `<li><span>Delivery</span><span>Paused — no deliverer assigned</span></li>`;

  return {
    eyebrow: 'Building',
    title: label,
    statusText,
    statusState,
    detailsHtml: `
      ${buildingCostRows(building.kind, cost)}
      ${buildingExtentRow(building.kind)}
      ${buildingRoadAccessRow(context.worldQueries, building)}
      <li><span>Crew split</span><span>${formatFoodCrewSplit(building.assignedLabor)}</span></li>
      <li><span>Harvest interval</span><span>${building.assignedLabor > 0 ? `${cycleSeconds.toFixed(1)}s` : `${definition.harvestInterval}s`} (${building.assignedLabor} workers)</span></li>
      <li><span>Road-linked homes</span><span>${claimedResidences.length === 0 ? 'None in range' : `${claimedResidences.length} claimed`}</span></li>
      ${deliveryRow}
      ${buildingStorageRows(building, building.kind)}
    `,
    demolish: {
      visible: true,
      hint: buildingDemolishHint(building.kind),
    },
    labor: buildingLaborView(building, context.populationStats),
  };
}
