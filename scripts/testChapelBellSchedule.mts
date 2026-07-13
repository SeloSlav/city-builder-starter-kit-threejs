import {
  CHAPEL_BELL_EVENING_HOUR,
  CHAPEL_BELL_MORNING_HOUR,
  isChapelBellHour,
} from '../src/audio/chapelBellSchedule.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(isChapelBellHour(CHAPEL_BELL_MORNING_HOUR), 'morning bell hour');
assert(isChapelBellHour(CHAPEL_BELL_EVENING_HOUR), 'evening bell hour');
assert(!isChapelBellHour(12), 'noon is not a bell hour');
assert(!isChapelBellHour(0), 'midnight is not a bell hour');
assert(CHAPEL_BELL_MORNING_HOUR === 6, 'morning bell at 6 AM');
assert(CHAPEL_BELL_EVENING_HOUR === 18, 'evening bell at 6 PM');

console.log('chapel bell schedule tests passed');
