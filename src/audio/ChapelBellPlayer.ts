import { CHURCH_BELL_CLIP } from './audioCatalog.ts';
import { CHAPEL_BELL_UNPRIMED_HOUR, isChapelBellHour } from './chapelBellSchedule.ts';

async function loadAudioAsBlobUrl(path: string): Promise<string> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export class ChapelBellPlayer {
  private audio: HTMLAudioElement | null = null;
  private blobUrl: string | null = null;
  private lastObservedHour = CHAPEL_BELL_UNPRIMED_HOUR;

  tick(clockHour: number, hasChapel: boolean, enabled: boolean): void {
    if (!enabled) return;

    if (this.lastObservedHour === CHAPEL_BELL_UNPRIMED_HOUR) {
      this.lastObservedHour = clockHour;
      return;
    }
    if (clockHour === this.lastObservedHour) return;

    this.lastObservedHour = clockHour;
    if (!hasChapel || !isChapelBellHour(clockHour)) return;
    if (this.audio && !this.audio.paused) return;

    this.play();
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    this.lastObservedHour = CHAPEL_BELL_UNPRIMED_HOUR;
  }

  dispose(): void {
    this.stop();
  }

  private play(): void {
    if (this.audio) {
      this.audio.currentTime = 0;
      this.audio.volume = CHURCH_BELL_CLIP.volume ?? 1;
      this.audio.loop = false;
      void this.audio.play().catch(() => undefined);
      return;
    }

    void loadAudioAsBlobUrl(CHURCH_BELL_CLIP.path)
      .then((url) => {
        if (this.audio) {
          URL.revokeObjectURL(url);
          return;
        }
        this.blobUrl = url;
        const audio = new Audio(url);
        audio.volume = CHURCH_BELL_CLIP.volume ?? 1;
        audio.loop = false;
        audio.addEventListener('error', () => {
          if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
          }
          if (this.audio === audio) {
            this.audio = null;
          }
        });
        this.audio = audio;
        void audio.play().catch(() => undefined);
      })
      .catch(() => {
        if (this.audio) return;
        const fallback = new Audio(CHURCH_BELL_CLIP.path);
        fallback.volume = CHURCH_BELL_CLIP.volume ?? 1;
        fallback.loop = false;
        fallback.addEventListener('error', () => {
          if (this.audio === fallback) {
            this.audio = null;
          }
        });
        this.audio = fallback;
        void fallback.play().catch(() => undefined);
      });
  }
}
