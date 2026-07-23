import type { InspectableTarget } from '../types.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';
import { hiddenDemolish, hiddenLabor } from './renderInspectableTarget.ts';

export function renderQuarryInspector(
  target: Extract<InspectableTarget, { kind: 'quarry' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { definition, state } = target;
  const nearestRoad = context.worldQueries.getNearestRoadNodeDistance(definition.x, definition.z);

  return {
    eyebrow: state.isRich ? 'Rich deposit' : 'Stone deposit',
    title: definition.label,
    statusText: state.remaining > 0
      ? `${Math.round(state.remaining)} / ${Math.round(state.maxYield)} surface stone remaining`
      : state.isRich
        ? 'Surface exhausted — underground stone remains available'
        : 'Exhausted — no stone left',
    statusState: state.remaining > 0 || state.isRich ? 'active' : 'idle',
    detailsHtml: `
      <li><span>Nearest road</span><span>${nearestRoad == null ? 'None nearby' : `${nearestRoad.toFixed(1)} m`}</span></li>
      <li><span>Surface labor</span><span>Assign at a Stonecutter's Camp nearby</span></li>
      ${state.isRich ? '<li><span>Underground source</span><span>Rich · supports a Large Quarry</span></li>' : ''}
    `,
    demolish: hiddenDemolish(),
    labor: hiddenLabor(),
  };
}
