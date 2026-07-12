import * as THREE from 'three';
import type { ForagingNodeState } from '../resources/types.ts';
import type { WorldMapMarker } from './worldMapMarkers.ts';
import { isWorldMapForagingMarkerVisible } from './worldMapMarkers.ts';
import type { Terrain } from '../terrain/Terrain.ts';
import {
  beginMapIconFrame,
  createMapIconRoot,
  placeProjectedMapButton,
} from './mapIconProjection.ts';

type ForagingMapIconsOptions = {
  uiRoot: HTMLElement;
  domElement: HTMLElement;
  terrain: Terrain;
  markers: readonly WorldMapMarker[];
  getForagingNodes: () => Map<string, ForagingNodeState>;
  getCamera: () => THREE.PerspectiveCamera | null;
  getZoomPercent: () => number;
  onForagingSelect: (nodeId: string) => void;
  isBlocked: () => boolean;
};

type ForagingIconEntry = {
  marker: WorldMapMarker;
  button: HTMLButtonElement;
  worldPoint: THREE.Vector3;
};

const GAME_ICON_SVG = `
  <svg class="foraging-map-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.5 18.5 10 6.5h4l3.5 12H6.5Z" fill="currentColor" opacity="0.9"/>
    <path d="M11 8.5h2l1.2 4.2h-4.4L11 8.5Z" fill="currentColor" opacity="0.35"/>
    <circle cx="16.5" cy="8" r="1.4" fill="currentColor"/>
  </svg>
`.trim();

const BERRY_ICON_SVG = `
  <svg class="foraging-map-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="9" cy="11" r="2.2" fill="currentColor" opacity="0.92"/>
    <circle cx="13.5" cy="9.5" r="2" fill="currentColor" opacity="0.82"/>
    <circle cx="15" cy="13.5" r="1.8" fill="currentColor" opacity="0.78"/>
    <circle cx="11" cy="15" r="1.6" fill="currentColor" opacity="0.7"/>
    <path d="M12 5.5c1.2 0 2.2.8 2.4 2" stroke="currentColor" stroke-width="1.2" fill="none"/>
  </svg>
`.trim();

export class ForagingMapIcons {
  private readonly options: ForagingMapIconsOptions;
  private readonly root: HTMLElement;
  private readonly entries: ForagingIconEntry[];

  constructor(options: ForagingMapIconsOptions) {
    this.options = options;
    this.root = createMapIconRoot(options.uiRoot, 'foraging-map-icons');

    this.entries = options.markers.map((marker) => ({
      marker,
      button: this.createIconButton(marker),
      worldPoint: new THREE.Vector3(),
    }));

    for (const entry of this.entries) {
      this.root.appendChild(entry.button);
    }
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

    const nodes = this.options.getForagingNodes();

    for (const entry of this.entries) {
      const { marker, button, worldPoint } = entry;
      if (!isWorldMapForagingMarkerVisible(marker, nodes)) {
        button.hidden = true;
        continue;
      }

      placeProjectedMapButton(button, marker.x, marker.z, worldPoint, frame);
    }
  }

  dispose(): void {
    this.root.remove();
  }

  private createIconButton(marker: WorldMapMarker): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'foraging-map-icon';
    button.dataset.foragingId = marker.id;
    button.title = marker.label;
    button.setAttribute('aria-label', marker.label);
    button.hidden = true;

    if (marker.kind === 'game') {
      button.classList.add('foraging-map-icon--game');
      button.innerHTML = GAME_ICON_SVG;
    } else {
      button.classList.add('foraging-map-icon--berries');
      button.innerHTML = BERRY_ICON_SVG;
    }

    button.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      if (this.options.isBlocked()) return;
      event.preventDefault();
      event.stopPropagation();
      this.options.onForagingSelect(marker.id);
    });

    return button;
  }
}
