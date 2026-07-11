import assert from 'node:assert/strict';
import {
  ABANDON_AFTER_DEFICIT_TICKS,
  CHAPEL_ABANDONMENT_DEFICIT_MULTIPLIER,
  CHAPEL_RECOVERY_NEEDS_REQUIRED,
  CHAPEL_RECOVERY_STOCK_MULTIPLIER,
  CHAPEL_SETTLEMENT_TICKS_MULTIPLIER,
  CHAPEL_TITHE_GOLD_PER_PERSON_PER_DAY,
  RESIDENCE_RECOVERY_FIREWOOD_MIN,
  RESIDENCE_SETTLE_TICKS,
} from '../src/generated/gameBalance.ts';
import {
  effectiveAbandonAfterDeficitTicks,
  effectiveResidenceSettleTicks,
  formatChapelAbandonmentGracePercent,
  formatChapelSettlementBoostPercent,
  recoveryNeedsRequired,
  recoveryStockMin,
} from '../src/economy/chapelCommunity.ts';
import {
  chapelAttendanceChance,
  chapelTitheGoldPerDay,
  expectedChapelTithePerDay,
} from '../src/economy/householdEconomy.ts';

function rustEffectiveSettleTicks(hasChapelAccess: boolean): number {
  if (!hasChapelAccess) {
    return RESIDENCE_SETTLE_TICKS;
  }
  return Math.ceil(RESIDENCE_SETTLE_TICKS * CHAPEL_SETTLEMENT_TICKS_MULTIPLIER);
}

function rustEffectiveAbandonAfterDeficitTicks(hasChapelAccess: boolean): number {
  if (!hasChapelAccess) {
    return ABANDON_AFTER_DEFICIT_TICKS;
  }
  return Math.ceil(ABANDON_AFTER_DEFICIT_TICKS / CHAPEL_ABANDONMENT_DEFICIT_MULTIPLIER);
}

assert.equal(effectiveResidenceSettleTicks(false), RESIDENCE_SETTLE_TICKS);
assert.equal(effectiveResidenceSettleTicks(true), rustEffectiveSettleTicks(true));
assert.equal(effectiveResidenceSettleTicks(true), 175);

assert.equal(effectiveAbandonAfterDeficitTicks(false), ABANDON_AFTER_DEFICIT_TICKS);
assert.equal(effectiveAbandonAfterDeficitTicks(true), rustEffectiveAbandonAfterDeficitTicks(true));
assert.equal(effectiveAbandonAfterDeficitTicks(true), 5143);

assert.equal(formatChapelSettlementBoostPercent(), '30%');
assert.equal(formatChapelAbandonmentGracePercent(), '43%');

assert.equal(recoveryNeedsRequired(false), 3);
assert.equal(recoveryNeedsRequired(true), CHAPEL_RECOVERY_NEEDS_REQUIRED);

assert.equal(
  recoveryStockMin('firewood', true),
  RESIDENCE_RECOVERY_FIREWOOD_MIN * CHAPEL_RECOVERY_STOCK_MULTIPLIER,
);

const population = 6;
const assignedLabor = 1;
const expectedDaily = expectedChapelTithePerDay(population, assignedLabor);
assert.ok(
  Math.abs(expectedDaily - chapelTitheGoldPerDay(population) * chapelAttendanceChance(assignedLabor)) < 1e-9,
);
assert.equal(chapelTitheGoldPerDay(population), population * CHAPEL_TITHE_GOLD_PER_PERSON_PER_DAY);

console.log('chapel community tests passed');
