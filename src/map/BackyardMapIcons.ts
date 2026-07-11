import * as THREE from 'three';
import { backyardIconPosition } from '../residences/backyardPosition.ts';
import { backyardGardenLabel, type BackyardGardenKind } from '../residences/backyardGarden.ts';
import type { BackyardGardenState, BurgageZoneState, ResidenceState } from '../resources/types.ts';
import type { Terrain } from '../terrain/Terrain.ts';
import {
  beginMapIconFrame,
  createMapIconRoot,
  placeProjectedMapButton,
} from './mapIconProjection.ts';

type BackyardMapIconsOptions = {
  uiRoot: HTMLElement;
  domElement: HTMLElement;
  terrain: Terrain;
  getCamera: () => THREE.PerspectiveCamera | null;
  getZoomPercent: () => number;
  getResidences: () => Iterable<ResidenceState>;
  getBurgageZones: () => Map<string, BurgageZoneState>;
  getBackyardGardens: () => Map<string, BackyardGardenState>;
  onBackyardSelect: (residenceId: string) => void;
  isBlocked: () => boolean;
};

type BackyardIconEntry = {
  residenceId: string;
  button: HTMLButtonElement;
  worldPoint: THREE.Vector3;
};

const GARDEN_ICON_SVG = `
  <svg class="backyard-map-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4.5c-2.8 2.2-4.5 4.8-4.5 7.5a4.5 4.5 0 1 0 9 0c0-2.7-1.7-5.3-4.5-7.5Z" fill="currentColor" opacity="0.88"/>
    <path d="M8.5 18.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M10 16.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
  </svg>
`.trim();

const EMPTY_BACKYARD_ICON_SVG = `
  <svg class="backyard-map-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6.5" y="8" width="11" height="9" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.3"/>
    <path d="M12 5.5v2.2M9.2 7.2 10.6 8.8M14.8 7.2 13.4 8.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M8.5 14.5h7M10 12h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.65"/>
  </svg>
`.trim();

export class BackyardMapIcons {
  private readonly options: BackyardMapIconsOptions;
  private readonly root: HTMLElement;
  private entries = new Map<string, BackyardIconEntry>();

  constructor(options: BackyardMapIconsOptions) {
    this.options = options;
    this.root = createMapIconRoot(options.uiRoot, 'backyard-map-icons');
  }

  update(): void {
    const frame = beginMapIconFrame(
      this.root,
      this.options.domElement,
      this.options.terrain,
      this.options.getCamera,
      this.options.getZoomPercent,
      this.options.isBlocked,
    );
    if (!frame) return;

    const zones = this.options.getBurgageZones();
    const gardens = this.options.getBackyardGardens();
    const seen = new Set<string>();

    for (const residence of this.options.getResidences()) {
      if (residence.abandoned) continue;
      const zone = zones.get(residence.zoneId);
      if (!zone) continue;

      const position = backyardIconPosition(residence, zone);
      if (!position) continue;

      seen.add(residence.id);
      const garden = gardens.get(residence.id);
      const entry = this.ensureEntry(residence.id, garden?.kind ?? null);
      this.syncEntryAppearance(entry, garden?.kind ?? null);
      placeProjectedMapButton(entry.button, position.x, position.z, entry.worldPoint, frame);
    }

    for (const [residenceId, entry] of this.entries) {
      if (seen.has(residenceId)) continue;
      entry.button.remove();
      this.entries.delete(residenceId);
    }
  }

  dispose(): void {
    this.root.remove();
  }

  private ensureEntry(residenceId: string, kind: BackyardGardenKind | null): BackyardIconEntry {
    const existing = this.entries.get(residenceId);
    if (existing) return existing;

    const button = this.createIconButton(residenceId, kind);
    this.root.appendChild(button);
    const entry: BackyardIconEntry = {
      residenceId,
      button,
      worldPoint: new THREE.Vector3(),
    };
    this.syncEntryAppearance(entry, kind);
    this.entries.set(residenceId, entry);
    return entry;
  }

  private syncEntryAppearance(entry: BackyardIconEntry, kind: BackyardGardenKind | null): void {
    const { button } = entry;
    button.classList.toggle('backyard-map-icon--active', kind != null);
    button.classList.toggle('backyard-map-icon--empty', kind == null);
    button.title = kind ? backyardGardenLabel(kind) : 'Plant a backyard garden';
    button.setAttribute('aria-label', button.title);
    button.innerHTML = kind ? GARDEN_ICON_SVG : EMPTY_BACKYARD_ICON_SVG;
  }

  private createIconButton(residenceId: string, kind: BackyardGardenKind | null): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'backyard-map-icon';
    button.dataset.residenceId = residenceId;
    button.hidden = true;

    this.syncEntryAppearance({ residenceId, button, worldPoint: new THREE.Vector3() }, kind);

    button.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      if (this.options.isBlocked()) return;
      event.preventDefault();
      event.stopPropagation();
      this.options.onBackyardSelect(residenceId);
    });

    return button;
  }
}
