import { clearStoredSpacetimeToken } from '../network/identityPersistence.ts';
import { resetWorld } from '../data/spacetimeReducers.ts';
import { WorldSetupPanel } from '../ui/WorldSetupPanel.ts';
import {
  DEFAULT_WORLD_GENERATION_SETTINGS,
  clearStoredWorldGenerationSettings,
  loadStoredWorldGenerationSettings,
  shouldShowWorldSetup,
  type WorldGenerationSettings,
} from '../world/worldGenerationSettings.ts';

export async function resolveWorldGenerationSettings(
  root: HTMLElement,
): Promise<WorldGenerationSettings> {
  if (shouldShowWorldSetup()) {
    return WorldSetupPanel.prompt(root);
  }
  return loadStoredWorldGenerationSettings() ?? DEFAULT_WORLD_GENERATION_SETTINGS;
}

export async function beginNewWorld(options?: { connected?: boolean }): Promise<void> {
  const offlineNote = options?.connected === false
    ? '\n\nSpacetimeDB is offline — the shared server database will NOT be reset until you reconnect.'
    : '';
  const confirmed = window.confirm(
    `Start a new world? This clears your saved world settings and local player identity, then reloads the page.${offlineNote}`,
  );
  if (!confirmed) return;

  if (options?.connected) {
    try {
      await resetWorld();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reset the server database.';
      window.alert(`New world failed: ${message}\n\nThe page was not reloaded.`);
      return;
    }
  }

  clearStoredWorldGenerationSettings();
  clearStoredSpacetimeToken('city-builder');
  const url = new URL(window.location.href);
  url.searchParams.set('new', '1');
  window.location.assign(url.toString());
}
