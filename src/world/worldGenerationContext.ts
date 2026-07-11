import {
  DEFAULT_WORLD_GENERATION_SETTINGS,
  resolveWorldDimensions,
  type WorldDimensions,
  type WorldGenerationSettings,
} from './worldGenerationSettings.ts';

let activeSettings: WorldGenerationSettings = DEFAULT_WORLD_GENERATION_SETTINGS;
let activeDimensions: WorldDimensions = resolveWorldDimensions(DEFAULT_WORLD_GENERATION_SETTINGS.mapSize);

export function setActiveWorldGeneration(settings: WorldGenerationSettings): void {
  activeSettings = settings;
  activeDimensions = resolveWorldDimensions(settings.mapSize);
}

export function getActiveWorldGeneration(): WorldGenerationSettings {
  return activeSettings;
}

export function getActiveWorldDimensions(): WorldDimensions {
  return activeDimensions;
}
