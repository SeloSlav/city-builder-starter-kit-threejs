export const GAME_PATCH_MAX_YIELD = 200;
/** Two berry patches share the old single-patch budget (2 × 60 = 120). */
export const BERRY_PATCH_MAX_YIELD = 60;
/** Fish shoals are inexhaustible; these values encode normal versus rich productivity. */
export const FISH_SHOAL_MAX_YIELD = 120;
export const RICH_FISH_SHOAL_MAX_YIELD = 240;

export const GAME_PATCH_PICK_RADIUS = 42;
export const BERRY_PATCH_PICK_RADIUS = 28;
export const FISH_SHOAL_PICK_RADIUS = 24;

export function foragingPickRadius(nodeKind: 'game' | 'berries' | 'fish'): number {
  if (nodeKind === 'game') return GAME_PATCH_PICK_RADIUS;
  if (nodeKind === 'fish') return FISH_SHOAL_PICK_RADIUS;
  return BERRY_PATCH_PICK_RADIUS;
}
