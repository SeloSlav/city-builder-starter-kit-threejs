const TREE_SHADOWS_KEY = 'medieval-road-system.treeShadowsDisabled';
const BUILDING_SHADOWS_KEY = 'medieval-road-system.buildingShadowsDisabled';

const listeners = new Set<() => void>();

export function areTreeShadowsDisabled(): boolean {
  try {
    return localStorage.getItem(TREE_SHADOWS_KEY) === '1';
  } catch {
    return false;
  }
}

export function areBuildingShadowsDisabled(): boolean {
  try {
    return localStorage.getItem(BUILDING_SHADOWS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTreeShadowsDisabled(disabled: boolean): void {
  try {
    if (disabled) localStorage.setItem(TREE_SHADOWS_KEY, '1');
    else localStorage.removeItem(TREE_SHADOWS_KEY);
  } catch {
    // Ignore private browsing / blocked storage.
  }
  notifyShadowPreferenceListeners();
}

export function setBuildingShadowsDisabled(disabled: boolean): void {
  try {
    if (disabled) localStorage.setItem(BUILDING_SHADOWS_KEY, '1');
    else localStorage.removeItem(BUILDING_SHADOWS_KEY);
  } catch {
    // Ignore private browsing / blocked storage.
  }
  notifyShadowPreferenceListeners();
}

export function subscribeShadowPreferences(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notifyShadowPreferenceListeners(): void {
  for (const listener of listeners) listener();
}
