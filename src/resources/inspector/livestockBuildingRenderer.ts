import { getBuildingDefinition } from '../buildings.ts';
import type { InspectableTarget } from '../types.ts';
import {
  buildingDemolishHint,
  buildingExtentRow,
  buildingLaborView,
  buildingRoadAccessRow,
} from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';

const SPECIES_LABEL = {
  cattle: 'Cattle',
  sheep: 'Sheep',
  swine: 'Swine',
} as const;

export function renderLivestockBuildingInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building } = target;
  const definition = getBuildingDefinition(building.kind);
  const herd = context.worldQueries.getLivestockHerd(building.id);
  const pastures = context.worldQueries.getPasturesForBuilding(building.id);
  const pastureArea = pastures.reduce((sum, pasture) => sum + pasture.area, 0);
  const healthPercent = Math.round((herd?.health ?? 0) * 100);
  const breedingPercent = Math.round((herd?.breedingProgress ?? 0) * 100);
  const overCapacity = herd ? herd.headCount > herd.suppliedCapacity : false;
  const active = Boolean(herd && pastures.length > 0 && building.assignedLabor > 0 && herd.health >= 0.45);
  const statusText = !herd
    ? 'Awaiting herd records'
    : pastures.length === 0
      ? 'Draw a fenced pasture'
      : building.assignedLabor === 0
        ? 'Awaiting herders'
        : overCapacity
          ? 'Over capacity — grain fallback active'
          : herd.health < 0.45
            ? 'Herd health is poor'
            : 'Herd tended';

  const role = building.kind === 'swineherd'
    ? 'Forest pannage → seasonal pork for smokehouses'
    : herd?.species === 'sheep'
      ? 'Upland grazing → food, cheese, and periodic wool income'
      : 'Pasture → dairy, field fertility, and ox ploughing power';

  const speciesControls = building.kind === 'pastoral_farmstead'
    ? `<div class="inspector-action-panel">
        <p class="resource-inspector-note">Herd specialization — switching keeps the building and pasture, but replaces the herd with starter stock.</p>
        <div class="resource-action-row">
          <button type="button" class="resource-action-button" data-livestock-species="cattle" ${herd?.species === 'cattle' ? 'disabled' : ''}>Cattle</button>
          <button type="button" class="resource-action-button" data-livestock-species="sheep" ${herd?.species === 'sheep' ? 'disabled' : ''}>Sheep</button>
        </div>
      </div>`
    : undefined;
  const pastureLabel = building.kind === 'swineherd' ? 'Fence woodland pannage' : 'Fence pasture';
  const pastureHint = building.kind === 'swineherd'
    ? 'Fence woodland for this holding. Parcel area and live mature trees determine the pigs’ capacity.'
    : 'Fence grazing land for this holding. Parcel area and terrain determine this herd’s capacity.';
  const pastureControls = `<div class="inspector-action-panel">
      <p class="resource-inspector-note">${pastureHint}</p>
      <div class="resource-action-row">
        <button type="button" class="resource-action-button" data-land-parcel="pasture">${pastureLabel}</button>
      </div>
    </div>`;

  const recentOutput = herd
    ? `${herd.lastFoodOutput.toFixed(2)} food · ${herd.lastPreservedOutput.toFixed(2)} preserved${herd.species === 'sheep' ? ` · ${herd.lastWoolGold.toFixed(2)} gold` : ''}`
    : 'None';
  const capacity = herd
    ? `${herd.headCount} head · ${herd.suppliedCapacity}/${herd.pastureCapacity} supplied/pasture capacity`
    : 'No herd';
  const woodlandRows = building.kind === 'swineherd'
    ? `<li><span>Mature pannage trees</span><span>${target.matureTrees}</span></li>
       <li><span>Forest condition</span><span>${target.matureTrees > 0 ? 'Live canopy supplies mast' : 'Clear-cut — grain-only fallback'}</span></li>`
    : '';
  const benefitRow = herd?.species === 'cattle'
    ? '<li><span>Field benefit</span><span>First 2 priority fields · faster ploughing + fertility</span></li>'
    : herd?.species === 'sheep'
      ? '<li><span>Terrain fit</span><span>Lower input · tolerates steeper upland pasture</span></li>'
      : '<li><span>Seasonality</span><span>Peak slaughter in autumn · lower output otherwise</span></li>';

  return {
    eyebrow: 'Livestock holding',
    title: definition.label,
    statusText,
    statusState: active ? 'active' : overCapacity || (herd?.health ?? 1) < 0.45 ? 'warning' : 'idle',
    detailsHtml: `
      <li><span>Role</span><span>${role}</span></li>
      <li><span>Herd</span><span>${herd ? SPECIES_LABEL[herd.species] : 'None'}</span></li>
      <li><span>Stocking</span><span>${capacity}</span></li>
      <li><span>Pastures</span><span>${pastures.length} · ${Math.round(pastureArea)} m² fenced</span></li>
      <li><span>Health</span><span>${healthPercent}%</span></li>
      <li><span>Breeding cycle</span><span>${breedingPercent}%</span></li>
      <li><span>Recent output</span><span>${recentOutput}</span></li>
      <li><span>Fallback grain</span><span>${building.grain.toFixed(1)} stored</span></li>
      ${benefitRow}
      ${woodlandRows}
      ${buildingRoadAccessRow(context.worldQueries, building)}
      ${buildingExtentRow(building.kind)}
    `,
    demolish: {
      visible: true,
      hint: pastures.length > 0
        ? `Remove its ${pastures.length === 1 ? 'pasture' : 'pastures'} first. ${buildingDemolishHint(building.kind)}`
        : buildingDemolishHint(building.kind),
    },
    labor: buildingLaborView(building, context.populationStats),
    supplementalPanelHtml: `${pastureControls}${speciesControls ?? ''}`,
  };
}
