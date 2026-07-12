import { clearStoredSpacetimeToken } from '../network/identityPersistence.ts';
import { probeServerWorldConfig } from '../network/serverWorldProbe.ts';
import { resetWorld } from '../data/spacetimeReducers.ts';
import { WorldSetupPanel } from '../ui/WorldSetupPanel.ts';
import { shouldRequireWorldRegeneration } from '../world/worldConfigAuthority.ts';
import {
  clearStoredWorldGenerationSettings,
  loadStoredWorldGenerationSettings,
  shouldShowWorldSetup,
  type WorldGenerationSettings,
} from '../world/worldGenerationSettings.ts';

export type WorldBootstrapProgress = {
  label: string;
  detail: string;
};

export async function resolveWorldGenerationSettings(
  root: HTMLElement,
  onProgress?: (progress: WorldBootstrapProgress) => void,
): Promise<WorldGenerationSettings> {
  if (shouldShowWorldSetup()) {
    return WorldSetupPanel.prompt(root);
  }

  const local = loadStoredWorldGenerationSettings();
  if (!local) {
    return WorldSetupPanel.prompt(root);
  }

  onProgress?.({
    label: 'Checking world…',
    detail: 'Verifying server state',
  });

  const probe = await probeServerWorldConfig();
  if (probe && shouldRequireWorldRegeneration(probe.generation, probe.simTick, local)) {
    clearStoredWorldGenerationSettings();
    onProgress?.({
      label: 'New settlement',
      detail: 'Server was reset — choose map size, landscape, and seed',
    });
    return WorldSetupPanel.prompt(root);
  }

  return local;
}

export async function beginNewWorld(isReady: () => boolean): Promise<void> {
  if (!isReady()) {
    window.alert('SpacetimeDB is not connected. Start the local server and try again.');
    return;
  }

  const confirmed = window.confirm(
    'Start a new world? This clears your saved world settings and local player identity, then reloads the page.',
  );
  if (!confirmed) return;

  try {
    await resetWorld();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reset the server database.';
    window.alert(`New world failed: ${message}\n\nThe page was not reloaded.`);
    return;
  }

  clearStoredWorldGenerationSettings();
  clearStoredSpacetimeToken('city-builder');
  const url = new URL(window.location.href);
  url.searchParams.set('new', '1');
  window.location.assign(url.toString());
}
