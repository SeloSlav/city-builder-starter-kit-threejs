export type AmbientLayerId =
  | 'birds_wind_day'
  | 'village_day'
  | 'night_insects'
  | 'open_wind_overview';

export type AudioClipDefinition = {
  path: string;
  volume?: number;
  loop?: boolean;
};

export const AMBIENT_LAYERS: Record<AmbientLayerId, AudioClipDefinition> = {
  birds_wind_day: { path: '/sounds/ambient/birds_wind_day.mp3', volume: 0.2, loop: true },
  village_day: { path: '/sounds/ambient/village_day.mp3', volume: 0.12, loop: true },
  night_insects: { path: '/sounds/ambient/night_insects.mp3', volume: 0.12, loop: true },
  open_wind_overview: { path: '/sounds/ambient/open_wind_overview.mp3', volume: 0.28, loop: true },
};

/** Chapel bell at 6 AM and 6 PM when a chapel is placed. ~30s clip, plays once per ring. */
export const CHURCH_BELL_CLIP: AudioClipDefinition = {
  path: '/sounds/ambient/church_bells.mp3',
  volume: 0.35,
};
