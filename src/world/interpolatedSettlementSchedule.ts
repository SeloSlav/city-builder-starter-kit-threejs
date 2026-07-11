import { DEFAULT_PARISH_POLICY } from '../economy/chapelParish.ts';
import type { ParishPolicyState } from '../economy/chapelParish.ts';
import { playerHasStaffedChapel } from '../logistics/landmarkAccess.ts';
import type { GameState } from '../resources/types.ts';
import { computeDayNightState } from './dayNightPresentation.ts';
import {
  gameClockAtElapsedSeconds,
  isLaborPaused,
  laborPauseLabel,
  type GameClock,
} from './gameCalendar.ts';
import type { SettlementSchedule } from './settlementSchedule.ts';

export function deriveInterpolatedSettlementSchedule(
  elapsedSeconds: number,
  parishPolicy: ParishPolicyState,
  gameState: GameState | null,
): SettlementSchedule {
  const clock = gameClockAtElapsedSeconds(elapsedSeconds);
  const sabbathObservance = parishPolicy.sabbathObservanceEnabled
    ?? DEFAULT_PARISH_POLICY.sabbathObservanceEnabled;
  const staffedChapel = gameState ? playerHasStaffedChapel(gameState.buildings.values()) : false;
  const laborPaused = isLaborPaused(clock, sabbathObservance, staffedChapel);
  return {
    clock,
    laborPaused,
    laborPauseLabel: laborPauseLabel(clock, sabbathObservance, staffedChapel),
    dayNight: computeDayNightState(clock, laborPaused),
    sabbathObservance,
    staffedChapel,
  };
}

export function interpolatedClock(elapsedSeconds: number): GameClock {
  return gameClockAtElapsedSeconds(elapsedSeconds);
}
