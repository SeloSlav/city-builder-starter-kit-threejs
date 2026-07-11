import type { BackyardGardenKind } from '../generated/gameBalance.ts';
import type { BuildingState, ResidenceState } from '../resources/types.ts';
import { expectedChapelTithePerDay } from './householdEconomy.ts';
import { backyardGardenNetWealthPerDay } from './villageGdp.ts';

export type HouseholdWealthSummary = {
  totalWealth: number;
  occupiedHomes: number;
  homesWithSavings: number;
};

export function summarizeHouseholdWealth(residences: Iterable<ResidenceState>): HouseholdWealthSummary {
  let totalWealth = 0;
  let occupiedHomes = 0;
  let homesWithSavings = 0;

  for (const residence of residences) {
    if (residence.abandoned || residence.population <= 0) {
      continue;
    }

    occupiedHomes += 1;
    totalWealth += residence.householdWealth;
    if (residence.householdWealth > 0.05) {
      homesWithSavings += 1;
    }
  }

  return { totalWealth, occupiedHomes, homesWithSavings };
}

export function estimateVillageHouseholdSavingsPerDay(
  gardens: Iterable<{ kind: BackyardGardenKind; residenceId: string }>,
  getResidence: (id: string) => ResidenceState | undefined,
  taxRate: number,
  isMarketplaceLinked: (residence: ResidenceState) => boolean,
): number {
  let total = 0;

  for (const garden of gardens) {
    const residence = getResidence(garden.residenceId);
    if (!residence || residence.abandoned || residence.population <= 0) {
      continue;
    }
    if (!isMarketplaceLinked(residence)) {
      continue;
    }

    total += backyardGardenNetWealthPerDay(garden.kind, residence.population, taxRate);
  }

  return total;
}

export function staffedChapelLabor(buildings: Iterable<BuildingState>): number {
  let labor = 0;
  for (const building of buildings) {
    if (building.kind === 'chapel' && building.assignedLabor > 0) {
      labor = Math.max(labor, building.assignedLabor);
    }
  }
  return labor;
}

export function estimateVillageChapelTithePerDay(
  residences: Iterable<ResidenceState>,
  isChapelLinked: (residence: ResidenceState) => boolean,
  chapelLabor: number,
): number {
  if (chapelLabor <= 0) {
    return 0;
  }

  let total = 0;
  for (const residence of residences) {
    if (residence.abandoned || residence.population <= 0) {
      continue;
    }
    if (!isChapelLinked(residence)) {
      continue;
    }

    total += expectedChapelTithePerDay(residence.population, chapelLabor);
  }

  return total;
}
