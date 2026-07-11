import type { BuildingKind } from '../generated/gameBalance.ts';
import type { PlacementBuildMenuAction } from './buildMenuCards.ts';

export const BUILDING_KIND_TO_MENU_ACTION: Record<BuildingKind, PlacementBuildMenuAction> = {
  lumber_mill: 'lumber-mill',
  reforester: 'reforester',
  stone_quarry: 'stone-quarry',
  woodcutters_lodge: 'woodcutters-lodge',
  well: 'well',
  hunters_hall: 'hunters-hall',
  foragers_shed: 'foragers-shed',
  chapel: 'chapel',
  marketplace: 'marketplace',
};

export type BuildingMenuAction = Exclude<PlacementBuildMenuAction, 'residences'>;

export const MENU_ACTION_TO_BUILDING_KIND: Record<BuildingMenuAction, BuildingKind> = {
  'lumber-mill': 'lumber_mill',
  'reforester': 'reforester',
  'stone-quarry': 'stone_quarry',
  'woodcutters-lodge': 'woodcutters_lodge',
  well: 'well',
  'hunters-hall': 'hunters_hall',
  'foragers-shed': 'foragers_shed',
  chapel: 'chapel',
  marketplace: 'marketplace',
};

export function toolbarModeToMenuAction(
  mode: BuildingKind | 'road' | 'residences' | 'idle',
): PlacementBuildMenuAction | null {
  if (mode === 'idle' || mode === 'road') return null;
  if (mode === 'residences') return 'residences';
  return BUILDING_KIND_TO_MENU_ACTION[mode];
}
