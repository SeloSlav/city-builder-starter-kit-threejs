import {
  type ResidenceFacadeColor,
  type ResidenceRoofColor,
} from '../buildings/buildingMaterials.ts';
import { mulberry32, pick } from '../utils/random.ts';

export type FacadeColor = ResidenceFacadeColor;
export type RoofColor = ResidenceRoofColor;
export type ResidenceArchetype = 'stone_portal' | 'timber_balcony' | 'working_lean_to';
export type ResidenceTrimColor = 'wood' | 'red' | 'blue' | 'green';

export type ResidenceAppearance = {
  facade: FacadeColor;
  roof: RoofColor;
  archetype: ResidenceArchetype;
  entrySide: -1 | 1;
  trim: ResidenceTrimColor;
};

const FACADE_COLORS: readonly FacadeColor[] = [
  'white',
  'yellow',
  'grey',
  'lightOrange',
  'orange',
] as const;

const ROOFS_BY_FACADE: Record<FacadeColor, readonly RoofColor[]> = {
  grey: ['red', 'red', 'brown'],
  lightOrange: ['red', 'red', 'grey', 'slate'],
  orange: ['red', 'red', 'grey', 'slate'],
  white: ['red', 'red', 'red', 'brown', 'grey', 'slate'],
  yellow: ['red', 'red', 'brown', 'grey', 'slate'],
};

const ARCHETYPES: readonly ResidenceArchetype[] = [
  'stone_portal',
  'stone_portal',
  'timber_balcony',
  'timber_balcony',
  'working_lean_to',
] as const;

const TRIM_COLORS: readonly ResidenceTrimColor[] = [
  'wood',
  'wood',
  'red',
  'blue',
  'green',
] as const;

const ENTRY_SIDES = [-1, 1] as const;

export function pickResidenceAppearance(seed: number): ResidenceAppearance {
  const rng = mulberry32(seed);
  const facade = pick(FACADE_COLORS, rng);
  const roof = pick(ROOFS_BY_FACADE[facade], rng);
  const archetype = pick(ARCHETYPES, rng);
  const entrySide = pick(ENTRY_SIDES, rng);
  const trim = pick(TRIM_COLORS, rng);
  return { facade, roof, archetype, entrySide, trim };
}

export function residenceGroundDoorLocalX(
  appearance: Pick<ResidenceAppearance, 'archetype' | 'entrySide'>,
): number {
  return appearance.entrySide * (appearance.archetype === 'working_lean_to' ? 1.18 : 1.38);
}
