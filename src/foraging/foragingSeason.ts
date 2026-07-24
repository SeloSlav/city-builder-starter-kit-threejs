import type { ForagingNodeKind } from './ForagingLayout.ts';

export type ForagingSeason = 'winter' | 'spring' | 'summer' | 'autumn';

export function foragingSeason(month: number): ForagingSeason {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function isForagingHarvestAvailable(
  kind: ForagingNodeKind,
  month: number,
): boolean {
  if (kind === 'game') return true;
  return foragingSeason(month) !== 'winter';
}

export function isForagingRegrowthSeason(
  kind: ForagingNodeKind,
  month: number,
): boolean {
  const season = foragingSeason(month);
  if (kind === 'berries' || kind === 'mushrooms') {
    return season === 'spring' || season === 'summer';
  }
  if (kind === 'fish') return season === 'spring';
  return true;
}
