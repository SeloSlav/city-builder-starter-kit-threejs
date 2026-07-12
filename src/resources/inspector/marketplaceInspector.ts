import { getBuildingCost } from '../buildingEconomy.ts';
import type { InspectableTarget } from '../types.ts';
import {
  buildingCostRows,
  buildingDemolishHint,
  buildingLaborView,
  buildingRoadAccessRow,
  buildingStorageRows,
} from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';
import { renderMarketplaceTradePanel } from './marketplaceTradeRenderer.ts';
import { formatMarketplaceCaravanCrew } from '../../economy/regionalMarket.ts';

function formatLinkedHomeStatus(connectedHomes: number): string {
  if (connectedHomes <= 0) {
    return 'Caravans awaiting your orders';
  }
  return `Trading with ${connectedHomes} road-linked home${connectedHomes === 1 ? '' : 's'}`;
}

export function renderMarketplaceInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building } = target;
  const availability = context.getTradeAvailability?.();
  if (!availability) {
    throw new Error('Marketplace inspector requires trade availability.');
  }
  const marketState = context.getMarketState?.();
  if (!marketState) {
    throw new Error('Marketplace inspector requires regional market state.');
  }

  const label = context.worldQueries.getBuildingLabel(building.kind);
  const cost = getBuildingCost(building.kind);
  const connectedHomes = context.worldQueries.countRoadConnectedResidences(building, true);
  const labor = buildingLaborView(building, context.populationStats);

  return {
    eyebrow: 'Building',
    title: label,
    statusText: formatLinkedHomeStatus(connectedHomes),
    statusState: connectedHomes > 0 ? 'ok' : 'idle',
    detailsHtml: `
      ${buildingCostRows(building.kind, cost)}
      ${buildingRoadAccessRow(context.worldQueries, building)}
      ${buildingStorageRows(building, building.kind)}
      <li><span>Purpose</span><span>Foreign trade hub — exchange gold and goods with neighboring villages</span></li>
      <li><span>Linked homes</span><span>${connectedHomes}</span></li>
      <li><span>Caravan crew</span><span>${formatMarketplaceCaravanCrew(building.assignedLabor)}</span></li>
      <li><span>Backyard sales</span><span>Road-linked homes only</span></li>
      <li><span>Household orders</span><span>Road-linked homes auto-buy provender when runway is low</span></li>
    `,
    demolish: {
      visible: true,
      hint: buildingDemolishHint(building.kind),
    },
    labor,
    supplementalPanelHtml: renderMarketplaceTradePanel(building, availability, marketState),
  };
}
