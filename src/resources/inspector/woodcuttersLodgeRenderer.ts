import { getBuildingCost } from '../buildingEconomy.ts';
import { getBuildingDefinition } from '../buildings.ts';
import type { InspectableTarget } from '../types.ts';
import { buildingStorageCaps } from '../resourceTotals.ts';
import {
  buildingCostRows,
  buildingDemolishHint,
  buildingLaborView,
  buildingRoadAccessRow,
  buildingStorageRows,
} from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';

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
  const connectedResidences = context.worldQueries.getRoadConnectedResidencesForLodge(building);
  const millsWithTimber = connectedMills.filter((mill) => mill.timber > 0).length;
  const roadAccess = context.worldQueries.getRoadAccessLabel(building.x, building.z);
  const onRoad = roadAccess.startsWith('Connected');
  const active = building.assignedLabor > 0 && onRoad && millsWithTimber > 0 && connectedResidences.length > 0;

  let statusText: string;
  let statusState: string;
  if (!onRoad) {
    statusText = 'Not connected — place near a road and link with paths';
    statusState = 'idle';
  } else if (building.assignedLabor === 0) {
    statusText = 'Idle — assign labor to process timber into firewood';
    statusState = 'idle';
  } else if (connectedMills.length === 0) {
    statusText = 'No road-linked lumber mills — connect a mill by road';
    statusState = 'warning';
  } else if (millsWithTimber === 0) {
    statusText = 'Road-linked mills have no timber yet';
    statusState = 'warning';
  } else if (connectedResidences.length === 0) {
    statusText = 'No road-linked residences to deliver firewood';
    statusState = 'warning';
  } else if (building.firewood >= caps.firewood) {
    statusText = 'Storage full — residences cannot accept more yet';
    statusState = 'idle';
  } else if (building.timber <= 0) {
    statusText = `Pulling timber from ${millsWithTimber} road-linked mill${millsWithTimber === 1 ? '' : 's'}`;
    statusState = 'active';
  } else {
    statusText = `Processing and delivering to ${connectedResidences.length} road-linked cottage${connectedResidences.length === 1 ? '' : 's'}`;
    statusState = active ? 'active' : 'idle';
  }

  const millSummary = connectedMills.length === 0
    ? 'None'
    : `${connectedMills.length} linked (${millsWithTimber} with timber)`;
  const residenceSummary = connectedResidences.length === 0
    ? 'None'
    : `${connectedResidences.length} linked`;

  return {
    eyebrow: 'Building',
    title: label,
    statusText,
    statusState,
    detailsHtml: `
      ${buildingCostRows(building.kind, cost)}
      ${buildingRoadAccessRow(context.worldQueries, building)}
      <li><span>Road-linked mills</span><span>${millSummary}</span></li>
      <li><span>Road-linked cottages</span><span>${residenceSummary}</span></li>
      <li><span>Process interval</span><span>${definition.harvestInterval}s</span></li>
      ${buildingStorageRows(building, building.kind)}
    `,
    demolish: {
      visible: true,
      hint: buildingDemolishHint(building.kind),
    },
    labor: buildingLaborView(building, context.populationStats),
  };
}
