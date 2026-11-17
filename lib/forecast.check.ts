// Self-check for the forecast engine. Run: yarn check:forecast
import assert from 'node:assert/strict';
import { addDays, format, getDay, parseISO, subDays } from 'date-fns';
import { forecast, MIN_DAYS } from '@/lib/forecast';
import type { Event } from '@/types/events';

const today = '2026-11-16'; // a Monday
const t = parseISO(today);
const ev = (id: number, type: Event['type'], name: string): Event => ({
  id, name, type, color: '#000', order: id, createdAt: t, updatedAt: t,
});
const day = (i: number) => format(subDays(t, i), 'yyyy-MM-dd');

// 1. Too little data: nothing predicted, says how many days are missing.
const few = forecast([{ event: ev(1, 'boolean', 'Gym'), values: [{ date: day(4), value: 'true' }] }], today);
assert.equal(few[0].days.length, 0);
assert.equal(few[0].daysNeeded, MIN_DAYS - 5);

// A new event next to an old one still needs its own 14 days.
const old = Array.from({ length: 70 }, (_, i) => ({ date: day(i), value: 'true' }));
const fresh = { ...ev(5, 'boolean', 'New'), createdAt: subDays(t, 4) };
const [, n] = forecast([{ event: ev(1, 'boolean', 'Old'), values: old }, { event: fresh, values: [{ date: day(0), value: 'true' }] }], today);
assert.equal(n.daysNeeded, MIN_DAYS - 5);

// 2. Weekday habit: gym on every Monday for 10 weeks, never otherwise.
const gym = Array.from({ length: 70 }, (_, i) => ({ date: day(i), value: getDay(subDays(t, i)) === 1 ? 'true' : 'false' }));
const [g] = forecast([{ event: ev(1, 'boolean', 'Gym'), values: gym }], today);
const nextMon = g.days.find(d => getDay(parseISO(d.date)) === 1)!;
const nextTue = g.days.find(d => getDay(parseISO(d.date)) === 2)!;
assert.ok(nextMon.probability > 0.5 && nextTue.probability < 0.1, 'Monday likely, Tuesday not');
assert.match(nextMon.reason, /10 of the last 10 Mondays/);

// 3. Cycle: every 3 days, last on today.
const pills = Array.from({ length: 60 }, (_, i) => ({ date: day(i), value: i % 3 === 0 ? 'true' : 'false' }));
const [p] = forecast([{ event: ev(2, 'boolean', 'Pill'), values: pills }], today);
assert.equal(p.days[2].date, format(addDays(t, 3), 'yyyy-MM-dd'));
assert.ok(p.days[2].probability > 0.8 && p.days[0].probability < 0.2, 'on-cycle day likely');
assert.match(p.days[2].reason, /every 3 days/);

// 4. Numbers give a likely value, text gives the most common value.
const sleep = Array.from({ length: 30 }, (_, i) => ({ date: day(i), value: '8' }));
const mood = Array.from({ length: 30 }, (_, i) => ({ date: day(i), value: i % 5 ? 'calm' : 'tired' }));
const [s, m] = forecast([
  { event: { ...ev(3, 'number', 'Sleep'), unit: 'hours' }, values: sleep },
  { event: ev(4, 'string', 'Mood'), values: mood },
], today);
assert.equal(s.days[0].expected, '8 hours');
assert.equal(m.days[0].expected, 'calm');
assert.ok(m.days[0].probability < 1, 'text chance is for the exact value');
assert.equal(s.days.length, 14);

console.log('forecast self-check: all good');
