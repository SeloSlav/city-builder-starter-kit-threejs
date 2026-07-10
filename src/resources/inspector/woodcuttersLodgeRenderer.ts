import { getBuildingCost } from '../buildingEconomy.ts';
import { getBuildingDefinition } from '../buildings.ts';
import {
  LODGE_FIREWOOD_PER_CYCLE,
  LODGE_TIMBER_PER_CYCLE,
} from '../../generated/gameBalance.ts';
import type { InspectableTarget } from '../types.ts';
import {
  buildingStorageCaps,
  lodgeDeliveryIntervalSeconds,
  lodgeFirewoodPerDelivery,
} from '../resourceTotals.ts';
import {
  buildingCostRows,
  buildingDemolishHint,
  buildingLaborView,
  buildingRoadAccessRow,
  buildingStorageRows,
} from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';

function formatCooldown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Ready';
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`;
  return `${seconds.toFixed(1)}s`;
}

export function renderWoodcuttersLodgeInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building } = target;
  const label = context.worldQueries.getBuildingLabel(building.kind);
  const cost = getBuildingCost(building.kind);
  const definition = getBuildingDefinition(building.kind);
  const caps = buildingStorageCaps(building.kind);
  const connectedMills = context.worldQueries.getRoadConnectedMills(building);
  const claimedResidences = context.worldQueries.getClaimedResidencesForLodge(building);
  const millsWithTimber = connectedMills.filter((mill) => mill.timber > 0).length;
  const roadAccess = context.worldQueries.getRoadAccessLabel(building.x, building.z);
  const onRoad = roadAccess.startsWith('Connected');
  const deliveryInterval = lodgeDeliveryIntervalSeconds(building.assignedLabor);
  const firewoodPerTrip = lodgeFirewoodPerDelivery(building.assignedLabor);
  const timberPerCycle = LODGE_TIMBER_PER_CYCLE * Math.max(1, building.assignedLabor);
  const firewoodPerCycle = LODGE_FIREWOOD_PER_CYCLE * Math.max(1, building.assignedLabor);
  const canDeliver = building.assignedLabor > 0 && onRoad && building.firewood > 0 && claimedResidences.length > 0;
  const deliveringSoon = canDeliver && building.deliveryCooldown <= 0.1;
  const onDeliveryCooldown = building.deliveryCooldown > 0.1;

  let statusText: string;
  let statusState: string;
  if (!onRoad) {
    statusText = 'Not connected — place near a road and link with paths';
    statusState = 'idle';
  } else if (building.assignedLabor === 0) {
    statusText = 'Idle — assign lodge workers to process timber and run deliveries';
    statusState = 'idle';
  } else if (connectedMills.length === 0) {
    statusText = 'No road-linked lumber mills — connect a mill by road';
    statusState = 'warning';
  } else if (millsWithTimber === 0 && building.timber <= 0) {
    statusText = 'Road-linked mills have no timber yet';
    statusState = 'warning';
  } else if (claimedResidences.length === 0) {
    statusText = 'No residences claimed on this road branch';
    statusState = 'warning';
  } else if (building.firewood <= 0 && building.timber <= 0) {
    statusText = `Pulling timber from ${millsWithTimber} nearest mill${millsWithTimber === 1 ? '' : 's'} by road`;
    statusState = 'active';
  } else if (building.firewood <= 0) {
    statusText = `Processing timber into firewood for ${claimedResidences.length} claimed home${claimedResidences.length === 1 ? '' : 's'}`;
    statusState = 'active';
  } else if (onDeliveryCooldown) {
    statusText = `Next delivery in ${formatCooldown(building.deliveryCooldown)} — ${claimedResidences.length} home${claimedResidences.length === 1 ? '' : 's'} on branch`;
    statusState = 'active';
  } else if (deliveringSoon) {
    statusText = `Dispatching firewood to nearest claimed residence (${firewoodPerTrip} per trip)`;
    statusState = 'active';
  } else {
    statusText = `Serving ${claimedResidences.length} claimed residence${claimedResidences.length === 1 ? '' : 's'} on this branch`;
    statusState = 'active';
  }

  const nearestMill = connectedMills[0];
  const nearestMillDistance = nearestMill
    ? context.worldQueries.getRoadPathDistance(building.x, building.z, nearestMill.x, nearestMill.z)
    : null;
  const millSummary = connectedMills.length === 0
    ? 'None'
    : `${connectedMills.length} by road${nearestMillDistance != null ? ` (nearest ${nearestMillDistance.toFixed(0)} m)` : ''}`;
  const residenceSummary = claimedResidences.length === 0
    ? 'None on branch'
    : `${claimedResidences.length} claimed`;

  const deliveryRow = building.assignedLabor > 0
    ? `<li><span>Delivery timer</span><span>${formatCooldown(building.deliveryCooldown)} / ${deliveryInterval.toFixed(1)}s</span></li>
      <li><span>Firewood per trip</span><span>${firewoodPerTrip}</span></li>`
    : `<li><span>Delivery</span><span>Paused — no lodge workers</span></li>`;

  return {
    eyebrow: 'Building',
    title: label,
    statusText,
    statusState,
    detailsHtml: `
      ${buildingCostRows(building.kind, cost)}
      ${buildingRoadAccessRow(context.worldQueries, building)}
      <li><span>Road-linked mills</span><span>${millSummary}</span></li>
      <li><span>Claimed residences</span><span>${residenceSummary}</span></li>
      <li><span>Process interval</span><span>${definition.harvestInterval}s</span></li>
      <li><span>Output per cycle</span><span>${building.assignedLabor > 0 ? `${firewoodPerCycle} firewood from ${timberPerCycle} timber` : `up to ${LODGE_FIREWOOD_PER_CYCLE * definition.maxLabor} firewood (${definition.maxLabor} workers)`}</span></li>
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
