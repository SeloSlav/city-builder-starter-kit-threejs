/** Game stock is an animal count so visible deer disappear one-for-one. */
export const GAME_PATCH_MAX_YIELD = 12;
/** Two berry patches share the old single-patch budget (2 × 60 = 120). */
export const BERRY_PATCH_MAX_YIELD = 60;
/** Deep-forest mushroom beds are smaller but replenish during the growing season. */
export const MUSHROOM_PATCH_MAX_YIELD = 42;
/** Fish values are persistent population carrying capacities. */
export const FISH_SHOAL_MAX_YIELD = 120;
export const RICH_FISH_SHOAL_MAX_YIELD = 240;

export const GAME_PATCH_PICK_RADIUS = 42;
export const BERRY_PATCH_PICK_RADIUS = 28;
export const MUSHROOM_PATCH_PICK_RADIUS = 24;
export const FISH_SHOAL_PICK_RADIUS = 24;

export function foragingPickRadius(nodeKind: 'game' | 'berries' | 'mushrooms' | 'fish'): number {
  if (nodeKind === 'game') return GAME_PATCH_PICK_RADIUS;
  if (nodeKind === 'mushrooms') return MUSHROOM_PATCH_PICK_RADIUS;
  if (nodeKind === 'fish') return FISH_SHOAL_PICK_RADIUS;
  return BERRY_PATCH_PICK_RADIUS;
}
