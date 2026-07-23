import { formatResourceAmount } from '../yields.ts';
import type { InspectableTarget } from '../types.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';
import { hiddenDemolish, hiddenLabor } from './renderInspectableTarget.ts';

export function renderForagingInspector(
  target: Extract<InspectableTarget, { kind: 'foraging' }>,
  _context: InspectorRenderContext,
): InspectorView {
  const { definition, state } = target;
  const isFish = definition.kind === 'fish';
  const depleted = state.remaining <= 0;

  return {
    eyebrow: isFish ? 'Water resource' : 'Wild harvest',
    title: definition.label,
    statusText: isFish
      ? `${state.isRich ? 'Rich' : 'Small'} inexhaustible shoal`
      : depleted
      ? 'Depleted — will return once the land recovers'
      : `${Math.round(state.remaining)} / ${Math.round(state.maxYield)} ${definition.resource} remaining`,
    statusState: depleted && !isFish ? 'idle' : 'active',
    detailsHtml: `
      <li><span>Resource</span><span>${isFish ? 'Fresh fish (becomes food)' : formatResourceAmount(definition.resource, state.remaining)}</span></li>
      ${isFish ? `<li><span>Reserve</span><span>Inexhaustible</span></li>
      <li><span>Richness</span><span>${state.isRich ? 'Rich shoal (1.75x catch)' : 'Small shoal'}</span></li>` : ''}
      <li><span>Harvest radius</span><span>${definition.pickRadius} m</span></li>
      <li><span>Location</span><span>${Math.round(definition.x)}, ${Math.round(definition.z)}</span></li>
    `,
    demolish: hiddenDemolish(),
    labor: hiddenLabor(),
  };
}
