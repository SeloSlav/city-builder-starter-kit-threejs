import {
  BACKYARD_GARDEN_DEFINITIONS,
  FOOD_SALE_GOLD_PER_UNIT,
  SIM_TICK_SECONDS,
  type BackyardGardenKind,
} from '../generated/gameBalance.ts';
import { gardenMarketActivity } from './gardenMarketActivity.ts';

export type BackyardGardenTickEffects = {
  selfFood: number;
  economicActivity: number;
};

export function computeBackyardGardenTickEffects(
  kind: BackyardGardenKind,
  population: number,
  hasMarketAccess: boolean,
  seconds = SIM_TICK_SECONDS,
): BackyardGardenTickEffects {
  const def = BACKYARD_GARDEN_DEFINITIONS[kind];
  const pop = Math.max(0, population);

  let selfFood = 0;
  if (def.foodPerPersonPerSec > 0) {
    const totalFood = def.foodPerPersonPerSec * pop * seconds;
    selfFood = totalFood * Math.max(0, Math.min(1, def.foodSelfShare));
  }

  const economicActivity = hasMarketAccess
    ? gardenMarketActivity(def, pop, seconds)
    : 0;

  return { selfFood, economicActivity };
}

export function foodSaleGoldFromSelfShare(
  foodPerPersonPerSec: number,
  foodSelfShare: number,
  population: number,
  seconds: number,
): number {
  const totalFood = foodPerPersonPerSec * population * seconds;
  const soldFood = totalFood * (1 - foodSelfShare);
  return soldFood * FOOD_SALE_GOLD_PER_UNIT;
}
