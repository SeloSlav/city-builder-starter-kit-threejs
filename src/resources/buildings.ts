import type { BuildingKind } from '../generated/gameBalance.ts';
import {
  BUILDING_DEFINITIONS,
  type BuildingDefinition,
} from '../generated/gameBalance.ts';

export type { BuildingDefinition };

export function getBuildingDefinition(kind: BuildingKind): BuildingDefinition {
  return BUILDING_DEFINITIONS[kind];
}
