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

// Helper to format event value for display
function formatEventValue(event: Event, dataPoints: EventDataPoint[]): string {
  if (dataPoints.length === 0) return '-';

  if (event.type === 'boolean') {
    const trueCount = dataPoints.filter(d => d.value === 1 || d.value === 'true').length;
    const rate = (trueCount / dataPoints.length) * 100;
    if (rate >= 70) return '✓';
    if (rate <= 30) return '✗';
    return `${rate.toFixed(0)}%`;
  } else if (event.type === 'number') {
    const values = dataPoints.map(d => Number(d.value) || 0);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      return `${Number.isInteger(avg) ? avg : avg.toFixed(1)}${event.unit || ''}`;
    } else {
      return `${Number.isInteger(min) ? min : min.toFixed(1)}-${Number.isInteger(max) ? max : max.toFixed(1)}${event.unit || ''}`;
    }
  } else {
    // String type - show most common value
    const valueCounts = new Map<string, number>();
    dataPoints.forEach(d => {
      const val = String(d.value);
      valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
    });

    let mostCommon = '';
    let maxCount = 0;
    valueCounts.forEach((count, val) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = val;
      }
    });

    const rate = (maxCount / dataPoints.length) * 100;
    return rate >= 70 ? mostCommon : `${mostCommon} ${rate.toFixed(0)}%`;
  }
}

// Discover patterns in event data
export function discoverPatterns(
  allData: { event: Event; dataPoints: EventDataPoint[] }[]
): Pattern[] {
  if (allData.length < 2) return [];

  const patterns: Pattern[] = [];

  // Sort events by their order property
  const sortedData = [...allData].sort((a, b) => a.event.order - b.event.order);

  // 1. CO-OCCURRENCE PATTERNS: Show all events together for specific conditions
  const coOccurrencePatterns = findCoOccurrencePatterns(sortedData);
  patterns.push(...coOccurrencePatterns);

  // 2. DAY-OF-WEEK PATTERNS: Events that happen together on specific days
  const dayPatterns = findDayOfWeekPatterns(sortedData);
  patterns.push(...dayPatterns);

  // Sort by confidence and return top patterns
  return patterns
    .filter(p => p.confidence >= 65) // Only show patterns with 65%+ confidence
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // Top 20 patterns
}

// 1. CO-OCCURRENCE PATTERNS: Show ALL events together
function findCoOccurrencePatterns(sortedData: { event: Event; dataPoints: EventDataPoint[] }[]): Pattern[] {
  const patterns: Pattern[] = [];

  // Find boolean events to use as conditions
  const booleanEvents = sortedData.filter(d => d.event.type === 'boolean');

  for (const conditionEvent of booleanEvents) {
    // When condition is TRUE
    const trueDates = conditionEvent.dataPoints
      .filter(d => d.value === 1 || d.value === 'true')
      .map(d => d.date);

    if (trueDates.length >= 5) {
      // Get data for all events on those dates (in order)
      const eventSummaries: string[] = [];
      const relatedEvents: Event[] = [];

      for (const { event, dataPoints } of sortedData) {
        const matchingData = dataPoints.filter(d => trueDates.includes(d.date));

        if (matchingData.length > 0) {
          relatedEvents.push(event);
          const valueStr = formatEventValue(event, matchingData);
          eventSummaries.push(`${event.name}: ${valueStr}`);
        }
      }

      if (eventSummaries.length >= 2) {
        const description = eventSummaries.join(' → ');
        const confidence = Math.min(95, 65 + (trueDates.length * 2));

        patterns.push({
          description,
          confidence,
          type: 'co-occurrence',
          events: relatedEvents,
          strength: calculateStrength(confidence),
          sampleSize: trueDates.length,
          details: `When ${conditionEvent.event.name} is true (${trueDates.length} occurrences)`,
        });
      }
    }

    // When condition is FALSE
    const falseDates = conditionEvent.dataPoints
      .filter(d => d.value === 0 || d.value === 'false')
      .map(d => d.date);

    if (falseDates.length >= 5) {
      // Get data for all events on those dates (in order)
      const eventSummaries: string[] = [];
      const relatedEvents: Event[] = [];

      for (const { event, dataPoints } of sortedData) {
        const matchingData = dataPoints.filter(d => falseDates.includes(d.date));

        if (matchingData.length > 0) {
          relatedEvents.push(event);
          const valueStr = formatEventValue(event, matchingData);
          eventSummaries.push(`${event.name}: ${valueStr}`);
        }
      }

      if (eventSummaries.length >= 2) {
        const description = eventSummaries.join(' → ');
        const confidence = Math.min(95, 65 + (falseDates.length * 2));

        patterns.push({
          description,
          confidence,
          type: 'co-occurrence',
          events: relatedEvents,
          strength: calculateStrength(confidence),
          sampleSize: falseDates.length,
          details: `When ${conditionEvent.event.name} is false (${falseDates.length} occurrences)`,
        });
      }
    }
  }

  // Also create patterns for all events together (no specific condition)
  const allDates = new Set<string>();
  sortedData.forEach(({ dataPoints }) => {
    dataPoints.forEach(d => allDates.add(d.date));
  });

  if (allDates.size >= 10) {
    const eventSummaries: string[] = [];
    const relatedEvents: Event[] = [];

    for (const { event, dataPoints } of sortedData) {
      if (dataPoints.length > 0) {
        relatedEvents.push(event);
        const valueStr = formatEventValue(event, dataPoints);
        eventSummaries.push(`${event.name}: ${valueStr}`);
      }
    }

    if (eventSummaries.length >= 2) {
      const description = `Overall: ${eventSummaries.join(' → ')}`;
      const confidence = 75;

      patterns.push({
        description,
        confidence,
        type: 'co-occurrence',
        events: relatedEvents,
        strength: calculateStrength(confidence),
        sampleSize: allDates.size,
        details: 'Overall pattern across all dates',
      });
    }
  }

  return patterns;
}

// 2. DAY-OF-WEEK PATTERNS: Show all events for specific days
function findDayOfWeekPatterns(sortedData: { event: Event; dataPoints: EventDataPoint[] }[]): Pattern[] {
  const patterns: Pattern[] = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Group all data by day of week
  const byDay: Record<number, string[]> = {};
  for (let i = 0; i < 7; i++) {
    byDay[i] = [];
  }

  // Collect all dates
  const allDates = new Set<string>();
  sortedData.forEach(({ dataPoints }) => {
    dataPoints.forEach(d => allDates.add(d.date));
  });

  // Categorize dates by day of week
  allDates.forEach(date => {
    const dayIndex = getDay(parseISO(date));
    byDay[dayIndex].push(date);
  });

  // For each day with enough data, create a pattern showing all events
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dates = byDay[dayIndex];

    if (dates.length < 3) continue; // Need at least 3 samples

    const eventSummaries: string[] = [];
    const relatedEvents: Event[] = [];

    for (const { event, dataPoints } of sortedData) {
      const matchingData = dataPoints.filter(d => dates.includes(d.date));

      if (matchingData.length > 0) {
        relatedEvents.push(event);
        const valueStr = formatEventValue(event, matchingData);
        eventSummaries.push(`${event.name}: ${valueStr}`);
      }
    }

    if (eventSummaries.length >= 2) {
      const description = `${dayNames[dayIndex]}: ${eventSummaries.join(' → ')}`;
      const confidence = Math.min(95, 65 + dates.length);

      patterns.push({
        description,
        confidence,
        type: 'co-occurrence',
        events: relatedEvents,
        strength: calculateStrength(confidence),
        sampleSize: dates.length,
        details: `Pattern on ${dayNames[dayIndex]}s (${dates.length} occurrences)`,
      });
    }
  }

  return patterns;
}
