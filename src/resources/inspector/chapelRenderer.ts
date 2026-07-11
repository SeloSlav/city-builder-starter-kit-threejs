import { getBuildingCost } from '../buildingEconomy.ts';
import type { InspectableTarget } from '../types.ts';
import {
  formatChapelAbandonmentGracePercent,
  formatChapelRecoveryStockMultiplierPercent,
  formatChapelSettlementBoostPercent,
  formatChapelTithePerDay,
} from '../../economy/chapelCommunity.ts';
import { formatChapelAttendanceChance } from '../../economy/householdEconomy.ts';
import { CHAPEL_RECOVERY_NEEDS_REQUIRED } from '../../generated/gameBalance.ts';
import {
  buildingCostRows,
  buildingDemolishHint,
  buildingLaborView,
  buildingRoadAccessRow,
} from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';

function formatLinkedHomeStatus(connectedHomes: number, linkedPopulation: number, staffed: boolean): string {
  if (!staffed) {
    return 'Assign a priest to open parish services';
  }
  if (connectedHomes <= 0) {
    return 'Priest ready — awaiting road-linked homes';
  }
  return `Serving ${connectedHomes} road-linked home${connectedHomes === 1 ? '' : 's'} (${linkedPopulation} villagers)`;
}

export function renderChapelInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building } = target;
  const label = context.worldQueries.getBuildingLabel(building.kind);
  const cost = getBuildingCost(building.kind);
  const staffed = building.assignedLabor > 0;
  const connectedHomes = context.worldQueries.countRoadConnectedResidences(building, false);
  const linkedPopulation = context.worldQueries.countRoadConnectedPopulation(building);
  const settlementBoost = formatChapelSettlementBoostPercent();
  const abandonmentGrace = formatChapelAbandonmentGracePercent();
  const recoveryEase = formatChapelRecoveryStockMultiplierPercent();
  const titheLabel = formatChapelTithePerDay(linkedPopulation, building.assignedLabor);

  return {
    eyebrow: 'Building',
    title: label,
    statusText: formatLinkedHomeStatus(connectedHomes, linkedPopulation, staffed),
    statusState: staffed && connectedHomes > 0 ? 'ok' : staffed ? 'idle' : 'draft',
    detailsHtml: `
      ${buildingCostRows(building.kind, cost)}
      ${buildingRoadAccessRow(context.worldQueries, building)}
      <li><span>Purpose</span><span>Parish hub — tithes, settlement, resilience, and easier recovery</span></li>
      <li><span>Priest</span><span>${staffed ? 'Serving the parish' : 'Unstaffed — benefits inactive'}</span></li>
      <li><span>Linked homes</span><span>${connectedHomes}</span></li>
      <li><span>Linked population</span><span>${linkedPopulation}</span></li>
      <li><span>Tithe income</span><span>${staffed ? titheLabel : '—'}</span></li>
      <li><span>Attendance</span><span>${staffed ? formatChapelAttendanceChance(building.assignedLabor) : '—'}</span></li>
      <li><span>Settlement</span><span>${settlementBoost} faster when staffed & linked</span></li>
      <li><span>Shortages</span><span>${abandonmentGrace} longer before abandonment</span></li>
      <li><span>Recovery</span><span>${CHAPEL_RECOVERY_NEEDS_REQUIRED} of 3 needs · ${recoveryEase} lower restock thresholds</span></li>
    `,
    demolish: {
      visible: true,
      hint: buildingDemolishHint(building.kind),
    },
    labor: buildingLaborView(building, context.populationStats),
  };
}
