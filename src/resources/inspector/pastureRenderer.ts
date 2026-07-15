import type { InspectableTarget } from '../types.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';
import { hiddenLabor } from './renderInspectableTarget.ts';

const SPECIES_LABEL = {
  cattle: 'Cattle pasture',
  sheep: 'Sheep pasture',
  swine: 'Woodland pannage',
} as const;

export function renderPastureInspector(
  target: Extract<InspectableTarget, { kind: 'pasture' }>,
  _context: InspectorRenderContext,
): InspectorView {
  const { pasture, farmstead, herd } = target;
  const title = herd ? SPECIES_LABEL[herd.species] : 'Fenced pasture';
  return {
    eyebrow: 'Functional work parcel',
    title,
    statusText: !farmstead
      ? 'Orphaned — livestock building missing'
      : farmstead.assignedLabor > 0
        ? 'Herders are using this parcel'
        : 'Awaiting herders',
    statusState: farmstead?.assignedLabor ? 'active' : 'idle',
    detailsHtml: `
      <li><span>Linked holding</span><span>${farmstead ? farmstead.kind.replaceAll('_', ' ') : 'Missing'}</span></li>
      <li><span>Area</span><span>${Math.round(pasture.area)} m²</span></li>
      <li><span>Average slope</span><span>${pasture.averageSlopeDegrees.toFixed(1)}°</span></li>
      <li><span>Moisture</span><span>${Math.round(pasture.moisture * 100)}%</span></li>
      <li><span>Herd</span><span>${herd ? `${herd.headCount} ${herd.species}` : 'None'}</span></li>
      <li><span>Holding capacity</span><span>${herd ? `${herd.pastureCapacity} pasture · ${herd.suppliedCapacity} supplied` : 'Not calculated'}</span></li>
    `,
    demolish: {
      visible: true,
      label: herd?.species === 'swine' ? 'Remove pannage fence' : 'Remove pasture',
      hint: 'Clears this functional parcel and lowers the linked herd’s carrying capacity.',
    },
    labor: hiddenLabor(),
  };
}
