import type { WorldConfig } from '../generated/types.ts';
import {
  normalizeWorldGenerationSettings,
  type WorldGenerationSettings,
  type WorldMapSize,
} from './worldGenerationSettings.ts';

export type AuthoritativeWorldGeneration = WorldGenerationSettings & {
  configured: boolean;
};

const MAP_SIZE_CODES: Record<WorldMapSize, number> = {
  small: 0,
  medium: 1,
  large: 2,
};

const MAP_SIZE_BY_CODE: Record<number, WorldMapSize> = {
  0: 'small',
  1: 'medium',
  2: 'large',
};

export function encodeMapSize(mapSize: WorldMapSize): number {
  return MAP_SIZE_CODES[mapSize];
}

export function decodeMapSize(code: number): WorldMapSize {
  return MAP_SIZE_BY_CODE[code] ?? 'medium';
}

export function worldConfigRowToGeneration(row: WorldConfig): AuthoritativeWorldGeneration {
  return {
    ...normalizeWorldGenerationSettings({
      seed: Number(row.seed),
      mapSize: decodeMapSize(row.mapSize),
      topography: row.topography,
      hydrology: row.hydrology,
      forestDensity: row.forestDensity,
    }),
    configured: row.configured,
  };
}

export function generationMatchesServer(
  server: AuthoritativeWorldGeneration | null,
  local: WorldGenerationSettings,
): boolean {
  if (!server?.configured) return false;
  return server.seed === (local.seed >>> 0)
    && server.mapSize === local.mapSize
    && server.topography === local.topography
    && server.hydrology === local.hydrology
    && server.forestDensity === local.forestDensity;
}

export function settingsToConfigurePayload(settings: WorldGenerationSettings) {
  const normalized = normalizeWorldGenerationSettings(settings);
  return {
    seed: BigInt(normalized.seed >>> 0),
    mapSize: encodeMapSize(normalized.mapSize),
    topography: normalized.topography,
    hydrology: normalized.hydrology,
    forestDensity: normalized.forestDensity,
  };
}
