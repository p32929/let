import type { Event } from '@/types/events';
import { getDay, parseISO, differenceInDays } from 'date-fns';

interface EventDataPoint {
  date: string;
  value: number | string;
}

export interface Pattern {
  description: string;
  confidence: number; // 0-100%
  type: 'co-occurrence' | 'correlation' | 'sequential' | 'conditional';
  events: Event[];
  strength: 'weak' | 'moderate' | 'strong' | 'very-strong';
  sampleSize: number;
  details?: string;
}

// Helper to calculate strength
function calculateStrength(confidence: number): 'weak' | 'moderate' | 'strong' | 'very-strong' {
  if (confidence >= 90) return 'very-strong';
  if (confidence >= 80) return 'strong';
  if (confidence >= 65) return 'moderate';
  return 'weak';
}

// Discover patterns in event data
export function discoverPatterns(
  allData: { event: Event; dataPoints: EventDataPoint[] }[]
): Pattern[] {
  if (allData.length < 2) return [];

  const patterns: Pattern[] = [];

  // 1. CONDITIONAL PATTERNS: If A then B (including NOT A)
  const conditionalPatterns = findConditionalPatterns(allData);
  patterns.push(...conditionalPatterns);

  // 2. CORRELATION PATTERNS: Numeric correlations
  const correlationPatterns = findCorrelationPatterns(allData);
  patterns.push(...correlationPatterns);

  // 3. SEQUENTIAL PATTERNS: A followed by B
  const sequentialPatterns = findSequentialPatterns(allData);
  patterns.push(...sequentialPatterns);

  // 4. DAY-OF-WEEK PATTERNS: Events that happen together on specific days
  const dayPatterns = findDayOfWeekPatterns(allData);
  patterns.push(...dayPatterns);

  // Sort by confidence and return top patterns
  return patterns
    .filter(p => p.confidence >= 65) // Only show patterns with 65%+ confidence
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // Top 20 patterns
}

// 1. CONDITIONAL PATTERNS: If A then B
function findConditionalPatterns(allData: { event: Event; dataPoints: EventDataPoint[] }[]): Pattern[] {
  const patterns: Pattern[] = [];

  for (let i = 0; i < allData.length; i++) {
    for (let j = 0; j < allData.length; j++) {
      if (i === j) continue;

      const eventA = allData[i];
      const eventB = allData[j];

      // Skip if not boolean events
      if (eventA.event.type !== 'boolean') continue;

      // Find common dates
      const datesA = new Set(eventA.dataPoints.map(d => d.date));
      const commonDates = eventB.dataPoints.filter(d => datesA.has(d.date));

      if (commonDates.length < 5) continue; // Need at least 5 samples

      // Check: When A is TRUE, what % of time is B true/high?
      const aTrueDates = eventA.dataPoints.filter(d => d.value === 1 || d.value === 'true').map(d => d.date);
      const aFalseDates = eventA.dataPoints.filter(d => d.value === 0 || d.value === 'false').map(d => d.date);

      // When A is TRUE
      if (aTrueDates.length >= 3) {
        const bWhenATrue = eventB.dataPoints.filter(d => aTrueDates.includes(d.date));

        if (bWhenATrue.length >= 3) {
          if (eventB.event.type === 'boolean') {
            const bTrueCount = bWhenATrue.filter(d => d.value === 1 || d.value === 'true').length;
            const confidence = (bTrueCount / bWhenATrue.length) * 100;

            if (confidence >= 65) {
              patterns.push({
                description: `When ${eventA.event.name} ✓ → ${eventB.event.name} ✓ ${confidence.toFixed(0)}% of the time`,
                confidence,
                type: 'conditional',
                events: [eventA.event, eventB.event],
                strength: calculateStrength(confidence),
                sampleSize: bWhenATrue.length,
                details: `Out of ${aTrueDates.length} days with ${eventA.event.name}, ${eventB.event.name} happened ${bTrueCount} times`,
              });
            }
          } else if (eventB.event.type === 'number') {
            const avgWhenATrue = bWhenATrue.reduce((sum, d) => sum + (Number(d.value) || 0), 0) / bWhenATrue.length;

            // Compare to overall average
            const overallAvg = eventB.dataPoints.reduce((sum, d) => sum + (Number(d.value) || 0), 0) / eventB.dataPoints.length;

            const percentDiff = ((avgWhenATrue - overallAvg) / overallAvg) * 100;

            if (Math.abs(percentDiff) >= 20) {
              // At least 20% difference
              const confidence = Math.min(95, 65 + Math.abs(percentDiff));

              patterns.push({
                description: `When ${eventA.event.name} ✓ → ${eventB.event.name} avg ${avgWhenATrue.toFixed(1)}${eventB.event.unit || ''} (${percentDiff > 0 ? '+' : ''}${percentDiff.toFixed(0)}%)`,
                confidence,
                type: 'conditional',
                events: [eventA.event, eventB.event],
                strength: calculateStrength(confidence),
                sampleSize: bWhenATrue.length,
              });
            }
          }
        }
      }

      // When A is FALSE
      if (aFalseDates.length >= 3) {
        const bWhenAFalse = eventB.dataPoints.filter(d => aFalseDates.includes(d.date));

        if (bWhenAFalse.length >= 3) {
          if (eventB.event.type === 'boolean') {
            const bTrueCount = bWhenAFalse.filter(d => d.value === 1 || d.value === 'true').length;
            const confidence = (bTrueCount / bWhenAFalse.length) * 100;

            if (confidence >= 65) {
              patterns.push({
                description: `When ${eventA.event.name} ✗ → ${eventB.event.name} ✓ ${confidence.toFixed(0)}% of the time`,
                confidence,
                type: 'conditional',
                events: [eventA.event, eventB.event],
                strength: calculateStrength(confidence),
                sampleSize: bWhenAFalse.length,
                details: `Out of ${aFalseDates.length} days without ${eventA.event.name}, ${eventB.event.name} happened ${bTrueCount} times`,
              });
            }
          }
        }
      }
    }
  }

  return patterns;
}

// 2. CORRELATION PATTERNS: Numeric correlations
function findCorrelationPatterns(allData: { event: Event; dataPoints: EventDataPoint[] }[]): Pattern[] {
  const patterns: Pattern[] = [];

  const numericEvents = allData.filter(d => d.event.type === 'number');

  for (let i = 0; i < numericEvents.length; i++) {
    for (let j = i + 1; j < numericEvents.length; j++) {
      const eventA = numericEvents[i];
      const eventB = numericEvents[j];

      // Find common dates
      const dateMapA = new Map(eventA.dataPoints.map(d => [d.date, Number(d.value)]));
      const pairs: Array<[number, number]> = [];

      for (const pointB of eventB.dataPoints) {
        const valueA = dateMapA.get(pointB.date);
        if (valueA !== undefined) {
          pairs.push([valueA, Number(pointB.value)]);
        }
      }

      if (pairs.length < 5) continue; // Need at least 5 samples

      // Calculate Pearson correlation
      const correlation = calculatePearsonCorrelation(pairs);

      if (Math.abs(correlation) >= 0.5) {
        // At least moderate correlation
        const confidence = Math.min(95, 65 + Math.abs(correlation) * 30);

        const direction = correlation > 0 ? 'increases' : 'decreases';
        const absCorr = Math.abs(correlation);

        patterns.push({
          description: `${eventA.event.name} & ${eventB.event.name} ${direction} together (${(absCorr * 100).toFixed(0)}% correlation)`,
          confidence,
          type: 'correlation',
          events: [eventA.event, eventB.event],
          strength: calculateStrength(confidence),
          sampleSize: pairs.length,
          details: `Correlation coefficient: ${correlation.toFixed(2)}`,
        });
      }
    }
  }

  return patterns;
}

// 3. SEQUENTIAL PATTERNS: A followed by B
function findSequentialPatterns(allData: { event: Event; dataPoints: EventDataPoint[] }[]): Pattern[] {
  const patterns: Pattern[] = [];

  for (let i = 0; i < allData.length; i++) {
    for (let j = 0; j < allData.length; j++) {
      if (i === j) continue;

      const eventA = allData[i];
      const eventB = allData[j];

      // Only check boolean events for sequential patterns
      if (eventA.event.type !== 'boolean' || eventB.event.type !== 'boolean') continue;

      // Find dates where A is true
      const aTrueDates = eventA.dataPoints
        .filter(d => d.value === 1 || d.value === 'true')
        .map(d => d.date);

      if (aTrueDates.length < 3) continue;

      // Check: Within 1-3 days after A, does B happen?
      const bAfterA: { days: number; happened: boolean }[] = [];

      for (const aDate of aTrueDates) {
        const aParsed = parseISO(aDate);

        // Check next 1-3 days
        for (const bPoint of eventB.dataPoints) {
          const bParsed = parseISO(bPoint.date);
          const daysDiff = differenceInDays(bParsed, aParsed);

          if (daysDiff >= 1 && daysDiff <= 3) {
            bAfterA.push({
              days: daysDiff,
              happened: bPoint.value === 1 || bPoint.value === 'true',
            });
            break; // Only count first occurrence
          }
        }
      }

      if (bAfterA.length >= 3) {
        const bHappenedCount = bAfterA.filter(b => b.happened).length;
        const confidence = (bHappenedCount / bAfterA.length) * 100;

        if (confidence >= 65) {
          const avgDays = bAfterA.filter(b => b.happened).reduce((sum, b) => sum + b.days, 0) / bHappenedCount;

          patterns.push({
            description: `${eventA.event.name} followed by ${eventB.event.name} within ${avgDays.toFixed(1)} days (${confidence.toFixed(0)}%)`,
            confidence,
            type: 'sequential',
            events: [eventA.event, eventB.event],
            strength: calculateStrength(confidence),
            sampleSize: bAfterA.length,
          });
        }
      }
    }
  }

  return patterns;
}

// 4. DAY-OF-WEEK PATTERNS
function findDayOfWeekPatterns(allData: { event: Event; dataPoints: EventDataPoint[] }[]): Pattern[] {
  const patterns: Pattern[] = [];

  // Group by day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const eventData of allData) {
    if (eventData.event.type !== 'boolean') continue;

    const byDay: Record<number, { total: number; true: number }> = {};

    for (let i = 0; i < 7; i++) {
      byDay[i] = { total: 0, true: 0 };
    }

    for (const point of eventData.dataPoints) {
      const dayIndex = getDay(parseISO(point.date));
      byDay[dayIndex].total++;
      if (point.value === 1 || point.value === 'true') {
        byDay[dayIndex].true++;
      }
    }

    // Find days with high occurrence rate
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const stats = byDay[dayIndex];

      if (stats.total < 3) continue; // Need at least 3 samples

      const rate = (stats.true / stats.total) * 100;

      if (rate >= 70) {
        // Happens 70%+ of the time on this day
        patterns.push({
          description: `${eventData.event.name} happens on ${dayNames[dayIndex]}s (${rate.toFixed(0)}% of ${dayNames[dayIndex]}s)`,
          confidence: Math.min(95, 65 + (rate - 70)),
          type: 'co-occurrence',
          events: [eventData.event],
          strength: calculateStrength(Math.min(95, 65 + (rate - 70))),
          sampleSize: stats.total,
        });
      }
    }
  }

  return patterns;
}

// Calculate Pearson correlation coefficient
function calculatePearsonCorrelation(pairs: Array<[number, number]>): number {
  const n = pairs.length;
  if (n === 0) return 0;

  const sumX = pairs.reduce((sum, [x]) => sum + x, 0);
  const sumY = pairs.reduce((sum, [, y]) => sum + y, 0);
  const sumXY = pairs.reduce((sum, [x, y]) => sum + x * y, 0);
  const sumX2 = pairs.reduce((sum, [x]) => sum + x * x, 0);
  const sumY2 = pairs.reduce((sum, [, y]) => sum + y * y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;

  return numerator / denominator;
}
