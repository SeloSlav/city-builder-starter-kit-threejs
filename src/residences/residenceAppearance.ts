import {
  type ResidenceFacadeColor,
  type ResidenceRoofColor,
} from '../buildings/buildingMaterials.ts';
import { mulberry32, pick } from '../utils/random.ts';

export type FacadeColor = ResidenceFacadeColor;
export type RoofColor = ResidenceRoofColor;

export type ResidenceAppearance = {
  facade: FacadeColor;
  roof: RoofColor;
};

const FACADE_COLORS: readonly FacadeColor[] = [
  'white',
  'yellow',
  'grey',
  'lightOrange',
  'orange',
] as const;

const ROOFS_BY_FACADE: Record<FacadeColor, readonly RoofColor[]> = {
  grey: ['red', 'brown'],
  lightOrange: ['red', 'grey', 'slate'],
  orange: ['red', 'grey', 'slate'],
  white: ['red', 'brown', 'grey', 'slate'],
  yellow: ['red', 'brown', 'grey', 'slate'],
};

export function pickResidenceAppearance(seed: number): ResidenceAppearance {
  const rng = mulberry32(seed);
  const facade = pick(FACADE_COLORS, rng);
  const roof = pick(ROOFS_BY_FACADE[facade], rng);
  return { facade, roof };
}
