import type { Event } from '@/types/events';
import { addDays, differenceInCalendarDays, format, getDay, parseISO, subDays } from 'date-fns';
import { isDefaultValue } from '@/lib/data-optimization';

// Forecast: guesses what happens on the coming days from three signals in the history:
// 1. weekday rate (how often it happened on the same weekday lately)
// 2. recent rate (all days, recent days count more)
// 3. a repeating cycle (every N days, from the gaps between occurrences)
// ponytail: simple averaging of signals, not a trained model. Good enough to explain in one sentence.

export const MIN_DAYS = 14; // two of each weekday before we guess anything
const LOOKBACK = 120; // days of history used
const WEEKS = 10; // how many past weekdays to compare
const HALF_LIFE = 14; // a day 14 days ago counts half as much as today

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

export interface ForecastInput {
  event: Event;
  values: { date: string; value: string }[]; // only the days that were logged
}

export interface DayPrediction {
  date: string;
  probability: number; // 0..1: yes-no and numbers: chance it happens; text: chance of the expected value
  expected?: string; // likely value for number and text events
  reason: string;
}

export interface EventForecast {
  event: Event;
  trackedDays: number;
  daysNeeded: number; // 0 when there is enough history
  days: DayPrediction[];
  past: { date: string; value: number }[]; // last 14 days: 1/0 for yes-no, the number for numbers
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const pct = (k: number, n: number) => `${k} of the last ${n}`;
const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function forecast(inputs: ForecastInput[], today: string, horizon = 14): EventForecast[] {
  const todayDate = parseISO(today);

  return inputs.map(({ event, values }) => {
    const byDate = new Map(values.map(v => [v.date, v.value]));
    // Tracking of this event started when it was created, or on its first logged value if earlier.
    // Rows come straight from SQLite, so the field may be the raw created_at text.
    const created = (event as any).created_at ?? event.createdAt;
    let firstDay = created instanceof Date ? fmt(created) : /^\d{4}-\d{2}-\d{2}/.test(String(created)) ? String(created).slice(0, 10) : today;
    for (const v of values) if (v.date < firstDay && !isDefaultValue(v.value, event.type)) firstDay = v.date;
    const tracked = Math.max(0, differenceInCalendarDays(todayDate, parseISO(firstDay)) + 1);
    const span = Math.min(tracked, LOOKBACK);
    // History, oldest first. Missing days count as "did not happen", like the rest of the app.
    const history = Array.from({ length: span }, (_, i) => {
      const date = fmt(subDays(todayDate, span - 1 - i));
      const raw = byDate.get(date) ?? '';
      return { date, raw, hit: raw !== '' && !isDefaultValue(raw, event.type), ago: span - 1 - i };
    });

    const past = history.slice(-14).map(h => ({
      date: h.date,
      value: event.type === 'number' ? parseFloat(h.raw) || 0 : h.hit ? 1 : 0,
    }));

    if (tracked < MIN_DAYS) {
      return { event, trackedDays: tracked, daysNeeded: MIN_DAYS - tracked, days: [], past };
    }

    // Recent rate, recent days weighted more.
    let wSum = 0;
    let wHit = 0;
    for (const h of history) {
      const w = 0.5 ** (h.ago / HALF_LIFE);
      wSum += w;
      if (h.hit) wHit += w;
    }
    const recentRate = wSum ? wHit / wSum : 0;
    const last14 = history.slice(-14).filter(h => h.hit).length;

    // Repeating cycle: the most common gap between occurrences.
    const hitIdx = history.filter(h => h.hit).map(h => span - 1 - h.ago);
    const gaps = hitIdx.slice(1).map((d, i) => d - hitIdx[i]);
    const gapCount = new Map<number, number>();
    for (const g of gaps) gapCount.set(g, (gapCount.get(g) ?? 0) + 1);
    let cycle = 0;
    let cycleHits = 0;
    for (const [g, c] of gapCount) if (c > cycleHits) [cycle, cycleHits] = [g, c];
    const recentGaps = gaps.slice(-10);
    const cycleShare = recentGaps.length ? recentGaps.filter(g => g === cycle).length / recentGaps.length : 0;
    // Weekly cycles are left to the weekday signal, which explains them better.
    const hasCycle = cycle >= 2 && cycle !== 7 && gaps.length >= 3 && cycleShare >= 0.6;
    const lastHit = hitIdx.length ? fmt(subDays(todayDate, span - 1 - hitIdx[hitIdx.length - 1])) : '';

    const days: DayPrediction[] = [];
    for (let i = 1; i <= horizon; i++) {
      const day = addDays(todayDate, i);
      const date = fmt(day);
      const wd = getDay(day);

      const same = history.filter(h => getDay(parseISO(h.date)) === wd).slice(-WEEKS);
      const sameHits = same.filter(h => h.hit);
      const wdRate = same.length ? sameHits.length / same.length : recentRate;

      // The weekday counts most, the overall recent rate smooths it.
      let probability = same.length >= 3 ? 0.7 * wdRate + 0.3 * recentRate : recentRate;
      let reason: string;

      const onCycle = hasCycle && lastHit !== '' && differenceInCalendarDays(day, parseISO(lastHit)) % cycle === 0;
      if (hasCycle && onCycle) {
        probability = Math.max(probability, cycleShare);
        reason = `Repeats about every ${cycle} days (${pct(Math.round(cycleShare * recentGaps.length), recentGaps.length)} gaps), and this day is on that rhythm.`;
      } else if (hasCycle) {
        probability = Math.min(probability, 1 - cycleShare);
        const next = addDays(parseISO(lastHit), Math.ceil(differenceInCalendarDays(day, parseISO(lastHit)) / cycle) * cycle);
        reason = `Repeats about every ${cycle} days, so the next one is more likely on ${format(next, 'EEE, MMM d')}.`;
      } else if (same.length >= 3 && Math.abs(wdRate - recentRate) >= 0.15) {
        reason = wdRate > recentRate
          ? `Happened on ${pct(sameHits.length, same.length)} ${WEEKDAYS[wd]}, more than on other days.`
          : sameHits.length
            ? `Happened on only ${pct(sameHits.length, same.length)} ${WEEKDAYS[wd]}, less than on other days.`
            : `Did not happen on any of the last ${same.length} ${WEEKDAYS[wd]}.`;
      } else {
        reason = `Happened on ${pct(last14, 14)} days.`;
        if (same.length >= 3) reason += ` On ${WEEKDAYS[wd]}: ${sameHits.length} of ${same.length}.`;
      }

      // Trend: compare the last 14 days with the 14 before.
      const prev14 = history.slice(-28, -14).filter(h => h.hit).length;
      if (history.length >= 28 && Math.abs(last14 - prev14) >= 3) {
        reason += last14 > prev14 ? ' Happening more often lately.' : ' Happening less often lately.';
      }

      // A value that is logged nearly every day: the value is the forecast, not the chance.
      if (event.type !== 'boolean' && wdRate >= 0.9 && recentRate >= 0.9) reason = '';
      let expected: string | undefined;
      const pool = sameHits.length ? sameHits : history.filter(h => h.hit).slice(-WEEKS);
      const when = sameHits.length ? `on ${WEEKDAYS[wd]}` : 'lately';
      if (event.type === 'number' && pool.length) {
        let s = 0;
        let w = 0;
        for (const h of pool) {
          const wt = 0.5 ** (h.ago / HALF_LIFE);
          s += (parseFloat(h.raw) || 0) * wt;
          w += wt;
        }
        expected = `${round(s / w)}${event.unit ? ' ' + event.unit : ''}`;
        reason += ` Usually ${expected} ${when}.`;
      } else if (event.type === 'string' && pool.length) {
        const counts = new Map<string, number>();
        for (const h of pool) {
          const v = h.raw.trim().toLowerCase();
          counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
        expected = top;
        probability *= n / pool.length; // chance of this exact value, not just of any text
        reason += ` Most often "${top}" ${when} (${n} of ${pool.length}).`;
      }

      days.push({ date, probability: Math.min(1, Math.max(0, probability)), expected, reason: reason.trim() });
    }

    return { event, trackedDays: tracked, daysNeeded: 0, days, past };
  });
}
