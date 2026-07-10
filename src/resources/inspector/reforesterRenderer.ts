import { getBuildingCost } from '../buildingEconomy.ts';
import type { InspectableTarget } from '../types.ts';
import {
  buildingCostRows,
  buildingDemolishHint,
  buildingLaborView,
  buildingStorageRows,
  buildingWorkRadiusRow,
  treeCountRows,
} from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';

export function renderReforesterInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building, matureTrees, stumpTrees, growingTrees } = target;
  const label = context.worldQueries.getBuildingLabel(building.kind);
  const cost = getBuildingCost(building.kind);

  return {
    eyebrow: 'Building',
    title: label,
    statusText: stumpTrees + growingTrees > 0
      ? `Reforesting — ${stumpTrees} stumps, ${growingTrees} growing`
      : 'Idle — no stumps in range',
    statusState: stumpTrees + growingTrees > 0 ? 'active' : 'draft',
    detailsHtml: `
      ${buildingCostRows(building.kind, cost)}
      ${buildingWorkRadiusRow(building.kind)}
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
