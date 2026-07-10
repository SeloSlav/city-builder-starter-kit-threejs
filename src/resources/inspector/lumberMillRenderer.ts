import { getBuildingCost } from '../buildingEconomy.ts';
import { getBuildingDefinition } from '../buildings.ts';
import { buildingStorageCaps, laborScaledInterval } from '../resourceTotals.ts';
import type { InspectableTarget } from '../types.ts';
import {
  buildingCostRows,
  buildingDemolishHint,
  buildingLaborView,
  buildingRoadAccessRow,
  buildingStorageRows,
  buildingWorkRadiusRow,
  treeCountRows,
} from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';

export function renderLumberMillInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building, matureTrees, stumpTrees, growingTrees } = target;
  const label = context.worldQueries.getBuildingLabel(building.kind);
  const cost = getBuildingCost(building.kind);
  const definition = getBuildingDefinition(building.kind);
  const storageCaps = buildingStorageCaps(building.kind);
  const storageFull = storageCaps.timber > 0 && building.timber >= storageCaps.timber - 0.001;
  const active = building.assignedLabor > 0 && matureTrees > 0 && !storageFull;
  const cycleSeconds = laborScaledInterval(definition.harvestInterval, building.assignedLabor);

  return {
    eyebrow: 'Building',
    title: label,
    statusText: building.assignedLabor === 0
      ? 'Idle — assign labor to harvest timber'
      : storageFull
        ? `Storage full — not harvesting (${matureTrees} mature trees in range)`
        : matureTrees > 0
          ? `Harvesting — ${matureTrees} mature trees in range`
          : 'Idle — no mature trees in range',
    statusState: active ? 'active' : 'idle',
    detailsHtml: `
      ${buildingCostRows(building.kind, cost)}
      ${buildingRoadAccessRow(context.worldQueries, building)}
      ${buildingWorkRadiusRow(building.kind)}
      <li><span>Harvest interval</span><span>${building.assignedLabor > 0 ? `${cycleSeconds.toFixed(1)}s` : `${definition.harvestInterval}s`} (${building.assignedLabor} workers)</span></li>
      ${treeCountRows(matureTrees, stumpTrees, growingTrees)}
      ${buildingStorageRows(building, building.kind)}
    `,
    demolish: {
      visible: true,
      hint: buildingDemolishHint(building.kind),
    },
    labor: buildingLaborView(building, context.populationStats),
  };
}
