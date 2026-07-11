import { getBuildingCost } from '../buildingEconomy.ts';
import type { InspectableTarget } from '../types.ts';
import {
  buildingCostRows,
  buildingDemolishHint,
  buildingRoadAccessRow,
} from './buildingCommon.ts';
import { hiddenLabor } from './renderInspectableTarget.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';
import { renderMarketplaceTradePanel } from './marketplaceTradeRenderer.ts';

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

  const label = context.worldQueries.getBuildingLabel(building.kind);
  const cost = getBuildingCost(building.kind);
  const connectedHomes = context.worldQueries.countRoadConnectedResidences(building, true);

  return {
    eyebrow: 'Building',
    title: label,
    statusText: formatLinkedHomeStatus(connectedHomes),
    statusState: connectedHomes > 0 ? 'ok' : 'idle',
    detailsHtml: `
      ${buildingCostRows(building.kind, cost)}
      ${buildingRoadAccessRow(context.worldQueries, building)}
      <li><span>Purpose</span><span>Foreign trade hub — exchange gold and goods with neighboring villages</span></li>
      <li><span>Linked homes</span><span>${connectedHomes}</span></li>
      <li><span>Backyard sales</span><span>Road-linked homes only</span></li>
    `,
    demolish: {
      visible: true,
      hint: buildingDemolishHint(building.kind),
    },
    labor: hiddenLabor(),
    supplementalPanelHtml: renderMarketplaceTradePanel(building, availability),
  };
}
