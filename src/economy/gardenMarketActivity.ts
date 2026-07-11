import { FOOD_SALE_GOLD_PER_UNIT } from '../generated/gameBalance.ts';

export type GardenMarketActivityDef = {
  goldPerPersonPerSec: number;
  foodPerPersonPerSec: number;
  foodSelfShare: number;
};

/** Taxable market activity from a garden over a time window (seconds). */
export function gardenMarketActivity(
  def: GardenMarketActivityDef,
  population: number,
  seconds: number,
): number {
  const pop = Math.max(0, population);
  let activity = def.goldPerPersonPerSec * pop * seconds;

  if (def.foodPerPersonPerSec > 0) {
    const totalFood = def.foodPerPersonPerSec * pop * seconds;
    const soldFood = totalFood * (1 - def.foodSelfShare);
    activity += soldFood * FOOD_SALE_GOLD_PER_UNIT;
  }

  return activity;
}

export { SECONDS_PER_DAY } from '../world/gameCalendar.ts';
export { GAME_DAY_SECONDS } from '../world/gameCalendar.ts';
