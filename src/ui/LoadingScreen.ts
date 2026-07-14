import { loadingPercentForPhase, type LoadingPhase } from './loadingProgress.ts';

export type LoadingProgress = {
  label: string;
  detail?: string;
  phase?: LoadingPhase;
  fraction?: number;
  percent?: number;
};

const LOADING_ROOT_ID = 'app-loading';

export class LoadingScreen {
  private readonly root: HTMLElement;
  private readonly percentEl: HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly detailEl: HTMLElement;
  private readonly progressBarEl: HTMLElement;
  private readonly spinnerEl: HTMLElement | null;
  private readonly retryButton: HTMLButtonElement;
  private dismissed = false;
  private retryHandler: (() => void) | null = null;
  private displayedPercent = 0;

  constructor() {
    const root = document.getElementById(LOADING_ROOT_ID);
    if (!root) {
      throw new Error(`Missing #${LOADING_ROOT_ID} element.`);
    }

    const percentEl = root.querySelector<HTMLElement>('[data-loading-percent]');
    const labelEl = root.querySelector<HTMLElement>('[data-loading-label]');
    const detailEl = root.querySelector<HTMLElement>('[data-loading-detail]');
    const progressBarEl = root.querySelector<HTMLElement>('[data-loading-bar]');
    const retryButton = root.querySelector<HTMLButtonElement>('[data-loading-retry]');
    if (!percentEl || !labelEl || !detailEl || !progressBarEl || !retryButton) {
      throw new Error('Loading screen markup is missing percent, label, detail, bar, or retry elements.');
    }

    this.root = root;
    this.percentEl = percentEl;
    this.labelEl = labelEl;
    this.detailEl = detailEl;
    this.progressBarEl = progressBarEl;
    this.spinnerEl = root.querySelector<HTMLElement>('.app-loading-spinner');
    this.retryButton = retryButton;
    this.retryButton.addEventListener('click', () => {
      this.retryHandler?.();
    });
    this.renderPercent(0);
  }

  static tryCreate(): LoadingScreen | null {
    if (!document.getElementById(LOADING_ROOT_ID)) return null;
    return new LoadingScreen();
  }

  setProgress(progress: LoadingProgress): void {
    if (this.dismissed) return;
    this.clearErrorState();
    this.labelEl.textContent = progress.label;
    this.detailEl.textContent = progress.detail ?? '';

    const nextPercent = this.resolvePercent(progress);
    if (nextPercent != null) {
      this.displayedPercent = Math.max(this.displayedPercent, nextPercent);
      this.renderPercent(this.displayedPercent);
    }
  }

  setErrorState(progress: LoadingProgress, onRetry: () => void): void {
    if (this.dismissed) return;
    this.labelEl.textContent = progress.label;
    this.detailEl.textContent = progress.detail ?? '';
    this.retryHandler = onRetry;
    this.spinnerEl?.classList.add('is-hidden');
    this.retryButton.hidden = false;
    this.root.setAttribute('aria-busy', 'false');
  }

  clearErrorState(): void {
    this.retryHandler = null;
    this.spinnerEl?.classList.remove('is-hidden');
    this.retryButton.hidden = true;
    this.root.setAttribute('aria-busy', 'true');
  }

  dismiss(): void {
    if (this.dismissed || this.retryHandler !== null) return;
    this.displayedPercent = 100;
    this.renderPercent(100);
    this.dismissed = true;
    this.root.classList.add('is-dismissed');
    window.setTimeout(() => {
      this.root.remove();
    }, 420);
  }

  private resolvePercent(progress: LoadingProgress): number | null {
    if (progress.percent != null) {
      return Math.min(100, Math.max(0, progress.percent));
    }
    if (progress.phase != null) {
      return loadingPercentForPhase(progress.phase, progress.fraction ?? 0);
    }
    return null;
  }

  private renderPercent(percent: number): void {
    const rounded = Math.round(percent);
    this.percentEl.textContent = `${rounded}%`;
    this.progressBarEl.style.setProperty('--loading-progress', `${percent}%`);
    this.progressBarEl.setAttribute('aria-valuenow', String(rounded));
  }
}
