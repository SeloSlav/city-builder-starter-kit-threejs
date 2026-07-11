import {
  ECONOMIC_ACTIVITY_TAX_RATE_MAX,
  ECONOMIC_ACTIVITY_TAX_RATE_MIN,
} from '../generated/gameBalance.ts';
import {
  clampEconomicActivityTaxRate,
  ECONOMIC_ACTIVITY_TAX_RATE_DEFAULT,
  formatProductivityPercent,
  formatTaxRatePercent,
} from '../economy/villageEconomy.ts';
import { estimateVillageGdpPerDay, estimateVillageTaxPerDay } from '../economy/villageGdp.ts';
import {
  estimateVillageChapelTithePerDay,
  estimateVillageHouseholdSavingsPerDay,
  staffedChapelLabor,
  summarizeHouseholdWealth,
} from '../economy/villageHouseholdEconomy.ts';
import type { GameState } from '../resources/types.ts';
import type { WorldQueries } from '../resources/WorldQueries.ts';

type CityAdministrationPanelOptions = {
  onTaxRateChange: (taxRate: number) => void | Promise<void>;
  onTaxRateChangeFailed?: (error: unknown) => void;
  getGameState: () => GameState | null;
  getTaxRate: () => number;
  getWorldQueries?: () => WorldQueries | null;
  onOpenChange?: (open: boolean) => void;
};

const DEFAULT_TAX_PERCENT = Math.round(ECONOMIC_ACTIVITY_TAX_RATE_DEFAULT * 100);

export class CityAdministrationPanel {
  private readonly root: HTMLElement;
  private readonly slider: HTMLInputElement;
  private readonly taxRateValue: HTMLElement;
  private readonly productivityValue: HTMLElement;
  private readonly gdpValue: HTMLElement;
  private readonly householdWealthValue: HTMLElement;
  private readonly householdSavingsValue: HTMLElement;
  private readonly chapelTitheValue: HTMLElement;
  private readonly taxIncomeValue: HTMLElement;
  private readonly treasuryIncomeValue: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private open = false;
  private pendingRate: number | null = null;
  private debounceTimer: number | null = null;
  private readonly options: CityAdministrationPanelOptions;

  constructor(parent: HTMLElement, options: CityAdministrationPanelOptions) {
    this.options = options;

    this.root = document.createElement('section');
    this.root.className = 'city-admin-panel';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'City administration');
    this.root.innerHTML = `
      <header class="city-admin-panel__header">
        <div>
          <p class="city-admin-panel__eyebrow">Mayor's office</p>
          <h2 class="city-admin-panel__title">City administration</h2>
        </div>
        <button type="button" class="city-admin-panel__close" data-action="close" aria-label="Close">×</button>
      </header>
      <p class="city-admin-panel__intro">
        Set the mayor's tax on village trade. Garden sales split between household savings and treasury;
        a staffed chapel on the road can collect tithes from household wealth when villagers attend.
      </p>
      <label class="city-admin-panel__slider-label" for="city-admin-tax-slider">
        <span>Activity tax rate</span>
        <strong data-tax-rate-value>${DEFAULT_TAX_PERCENT}%</strong>
      </label>
      <input
        id="city-admin-tax-slider"
        class="city-admin-panel__slider"
        type="range"
        min="${Math.round(ECONOMIC_ACTIVITY_TAX_RATE_MIN * 100)}"
        max="${Math.round(ECONOMIC_ACTIVITY_TAX_RATE_MAX * 100)}"
        step="1"
        value="${DEFAULT_TAX_PERCENT}"
      />
      <div class="city-admin-panel__range-hints">
        <span>0% — growth</span>
        <span>45% — desperate</span>
      </div>
      <dl class="city-admin-panel__stats">
        <div class="city-admin-panel__stat">
          <dt>Village activity (GDP)</dt>
          <dd data-gdp-value>0 gold / day</dd>
        </div>
        <div class="city-admin-panel__stat">
          <dt>Household wealth</dt>
          <dd data-household-wealth-value>0 gold saved</dd>
        </div>
        <div class="city-admin-panel__stat">
          <dt>Household savings rate</dt>
          <dd data-household-savings-value>0 gold / day</dd>
        </div>
        <div class="city-admin-panel__stat">
          <dt>Trade productivity</dt>
          <dd data-productivity-value>100%</dd>
        </div>
        <div class="city-admin-panel__stat">
          <dt>Mayor tax income</dt>
          <dd data-tax-income-value>0 gold / day</dd>
        </div>
        <div class="city-admin-panel__stat">
          <dt>Parish tithe income</dt>
          <dd data-chapel-tithe-value>0 gold / day</dd>
        </div>
        <div class="city-admin-panel__stat city-admin-panel__stat--highlight">
          <dt>Est. treasury income</dt>
          <dd data-treasury-income-value>0 gold / day</dd>
        </div>
      </dl>
    `;

    parent.appendChild(this.root);

    this.slider = this.root.querySelector<HTMLInputElement>('#city-admin-tax-slider')!;
    this.taxRateValue = this.root.querySelector<HTMLElement>('[data-tax-rate-value]')!;
    this.productivityValue = this.root.querySelector<HTMLElement>('[data-productivity-value]')!;
    this.gdpValue = this.root.querySelector<HTMLElement>('[data-gdp-value]')!;
    this.householdWealthValue = this.root.querySelector<HTMLElement>('[data-household-wealth-value]')!;
    this.householdSavingsValue = this.root.querySelector<HTMLElement>('[data-household-savings-value]')!;
    this.chapelTitheValue = this.root.querySelector<HTMLElement>('[data-chapel-tithe-value]')!;
    this.taxIncomeValue = this.root.querySelector<HTMLElement>('[data-tax-income-value]')!;
    this.treasuryIncomeValue = this.root.querySelector<HTMLElement>('[data-treasury-income-value]')!;
    this.closeButton = this.root.querySelector<HTMLButtonElement>('[data-action="close"]')!;

    this.closeButton.addEventListener('click', () => this.close());
    this.root.addEventListener('mousedown', (event) => event.stopPropagation());
    this.root.addEventListener('click', (event) => event.stopPropagation());
    this.slider.addEventListener('input', () => this.onSliderInput());
  }

  isOpen(): boolean {
    return this.open;
  }

  openPanel(): void {
    if (this.open) return;
    this.open = true;
    this.root.hidden = false;
    this.syncTaxRate();
    this.options.onOpenChange?.(true);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.flushPendingRate();
    this.options.onOpenChange?.(false);
  }

  toggle(): void {
    if (this.open) this.close();
    else this.openPanel();
  }

  refresh(): void {
    if (!this.open) return;
    this.syncTaxRate();
  }

  dispose(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.root.remove();
  }

  private syncTaxRate(): void {
    const taxRate = this.options.getTaxRate();
    if (this.pendingRate === null) {
      this.slider.value = String(Math.round(taxRate * 100));
    }
    this.updateReadout(this.pendingRate ?? taxRate);
  }

  private onSliderInput(): void {
    const rate = clampEconomicActivityTaxRate(Number(this.slider.value) / 100);
    this.pendingRate = rate;
    this.updateReadout(rate);
    this.scheduleRateCommit(rate);
  }

  private scheduleRateCommit(rate: number): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.commitRate(rate);
    }, 280);
  }

  private flushPendingRate(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingRate !== null) {
      void this.commitRate(this.pendingRate);
    }
  }

  private async commitRate(rate: number): Promise<void> {
    try {
      await this.options.onTaxRateChange(rate);
      this.pendingRate = null;
    } catch (error) {
      this.options.onTaxRateChangeFailed?.(error);
      this.syncTaxRate();
    }
  }

  private updateReadout(taxRate: number): void {
    const gameState = this.options.getGameState();
    const worldQueries = this.options.getWorldQueries?.() ?? null;
    const gardens = gameState ? gameState.backyardGardens.values() : [];
    const residences = gameState ? gameState.residences.values() : [];
    const buildings = gameState ? gameState.buildings.values() : [];
    const getResidence = (id: string) => gameState?.residences.get(id);

    const gdp = gameState ? estimateVillageGdpPerDay(gardens, getResidence) : 0;
    const taxIncome = gameState ? estimateVillageTaxPerDay(gardens, getResidence, taxRate) : 0;
    const wealthSummary = summarizeHouseholdWealth(residences);
    const householdSavings = gameState && worldQueries
      ? estimateVillageHouseholdSavingsPerDay(
          gardens,
          (id) => gameState.residences.get(id),
          taxRate,
          (residence) => worldQueries.isResidenceConnectedToMarketplace(residence),
        )
      : 0;
    const chapelLabor = staffedChapelLabor(buildings);
    const chapelTithe = gameState && worldQueries
      ? estimateVillageChapelTithePerDay(
          residences,
          (residence) => worldQueries.isResidenceConnectedToChapel(residence),
          chapelLabor,
        )
      : 0;
    const treasuryIncome = taxIncome + chapelTithe;

    this.taxRateValue.textContent = formatTaxRatePercent(taxRate);
    this.productivityValue.textContent = formatProductivityPercent(taxRate);
    this.gdpValue.textContent = `${gdp.toFixed(1)} gold / day`;
    this.householdWealthValue.textContent = wealthSummary.occupiedHomes > 0
      ? `${wealthSummary.totalWealth.toFixed(1)} gold (${wealthSummary.homesWithSavings}/${wealthSummary.occupiedHomes} homes)`
      : '0 gold saved';
    this.householdSavingsValue.textContent = worldQueries
      ? `~${householdSavings.toFixed(1)} gold / day`
      : '—';
    this.taxIncomeValue.textContent = `~${taxIncome.toFixed(1)} gold / day`;
    this.chapelTitheValue.textContent = chapelLabor > 0 && worldQueries
      ? `~${chapelTithe.toFixed(1)} gold / day`
      : chapelLabor > 0 ? '—' : 'Unstaffed chapel';
    this.treasuryIncomeValue.textContent = `~${treasuryIncome.toFixed(1)} gold / day`;
  }
}
