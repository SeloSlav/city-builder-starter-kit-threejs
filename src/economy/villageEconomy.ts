import {
  ECONOMIC_ACTIVITY_TAX_RATE,
  ECONOMIC_ACTIVITY_TAX_RATE_MAX,
  ECONOMIC_ACTIVITY_TAX_RATE_MIN,
  HIGH_TAX_PRODUCTIVITY_DRAG,
  LOW_TAX_PRODUCTIVITY_BOOST,
} from '../generated/gameBalance.ts';

export function clampEconomicActivityTaxRate(rate: number): number {
  return Math.min(ECONOMIC_ACTIVITY_TAX_RATE_MAX, Math.max(ECONOMIC_ACTIVITY_TAX_RATE_MIN, rate));
}

/** Laffer-style productivity: low taxes stimulate trade; high taxes suppress it. Default rate = 1.0. */
export function economicActivityProductivityMultiplier(taxRate: number): number {
  const t = clampEconomicActivityTaxRate(taxRate);
  const tOpt = ECONOMIC_ACTIVITY_TAX_RATE;

  if (t <= tOpt + 1e-12) {
    const span = Math.max(1e-9, tOpt - ECONOMIC_ACTIVITY_TAX_RATE_MIN);
    const boost = LOW_TAX_PRODUCTIVITY_BOOST * (tOpt - t) / span;
    return 1 + boost;
  }

  const span = Math.max(1e-9, ECONOMIC_ACTIVITY_TAX_RATE_MAX - tOpt);
  const drag = HIGH_TAX_PRODUCTIVITY_DRAG * (t - tOpt) / span;
  return Math.max(0.12, 1 - drag);
}

export function taxedEconomicActivity(baseActivity: number, taxRate: number): { adjusted: number; tax: number } {
  const rate = clampEconomicActivityTaxRate(taxRate);
  const productivity = economicActivityProductivityMultiplier(rate);
  const adjusted = baseActivity * productivity;
  return { adjusted, tax: adjusted * rate };
}

export function formatTaxRatePercent(taxRate: number): string {
  return `${Math.round(clampEconomicActivityTaxRate(taxRate) * 100)}%`;
}

export function formatProductivityPercent(taxRate: number): string {
  const pct = Math.round(economicActivityProductivityMultiplier(taxRate) * 100);
  const delta = pct - 100;
  if (delta === 0) return '100% (baseline)';
  if (delta > 0) return `${pct}% (+${delta}%)`;
  return `${pct}% (${delta}%)`;
}

export const ECONOMIC_ACTIVITY_TAX_RATE_DEFAULT = ECONOMIC_ACTIVITY_TAX_RATE;
