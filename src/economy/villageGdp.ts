import {
  BACKYARD_GARDEN_DEFINITIONS,
  BACKYARD_GARDEN_KINDS,
  type BackyardGardenKind,
} from '../generated/gameBalance.ts';
import { gardenMarketActivity, SECONDS_PER_DAY } from './gardenMarketActivity.ts';
import { taxedEconomicActivity } from './villageEconomy.ts';

export function backyardGardenActivityPerDay(kind: BackyardGardenKind, population: number): number {
  return gardenMarketActivity(BACKYARD_GARDEN_DEFINITIONS[kind], population, SECONDS_PER_DAY);
}

export function backyardGardenTaxPerDay(
  kind: BackyardGardenKind,
  population: number,
  taxRate: number,
): number {
  const activity = gardenMarketActivity(BACKYARD_GARDEN_DEFINITIONS[kind], population, SECONDS_PER_DAY);
  return taxedEconomicActivity(activity, taxRate).tax;
}

export function backyardGardenNetWealthPerDay(
  kind: BackyardGardenKind,
  population: number,
  taxRate: number,
): number {
  const activity = gardenMarketActivity(BACKYARD_GARDEN_DEFINITIONS[kind], population, SECONDS_PER_DAY);
  const { adjusted, tax } = taxedEconomicActivity(activity, taxRate);
  return Math.max(0, adjusted - tax);
}

export function estimateVillageGdpPerDay(
  gardens: Iterable<{ kind: BackyardGardenKind; residenceId: string }>,
  getResidence: (id: string) => { abandoned: boolean; population: number } | undefined,
): number {
  let total = 0;
  for (const garden of gardens) {
    const residence = getResidence(garden.residenceId);
    if (!residence || residence.abandoned || residence.population <= 0) continue;
    total += backyardGardenActivityPerDay(garden.kind, residence.population);
  }
  return total;
}

export function estimateVillageTaxPerDay(
  gardens: Iterable<{ kind: BackyardGardenKind; residenceId: string }>,
  getResidence: (id: string) => { abandoned: boolean; population: number } | undefined,
  taxRate: number,
): number {
  const gdp = estimateVillageGdpPerDay(gardens, getResidence);
  return taxedEconomicActivity(gdp, taxRate).tax;
}

export { BACKYARD_GARDEN_KINDS };
