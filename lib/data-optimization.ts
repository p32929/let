import { getAllEventValues } from '@/db/operations/events';
import type { Event } from '@/types/events';

/**
 * Check if a value is a default value for the given event type
 */
export function isDefaultValue(value: string, eventType: 'boolean' | 'number' | 'string'): boolean {
  if (eventType === 'boolean') {
    return value === 'false' || value === '0';
  } else if (eventType === 'number') {
    return value === '0' || value === '0.0' || parseFloat(value) === 0;
  } else {
    // string type
    return value === '' || value.trim() === '';
  }
}

/**
 * Find the first date where at least one event has a non-default value
 * This helps us ignore days where everything is just default values
 */
export async function findFirstMeaningfulDate(events: Event[]): Promise<string | null> {
  if (events.length === 0) {
    return null;
  }

  // Get all event values ordered by date
  const allValues = await getAllEventValues();

  // Create a map of event IDs to their types for quick lookup
  const eventTypeMap = new Map(events.map(e => [e.id, e.type]));

  // Group values by date
  const valuesByDate = new Map<string, Array<{ eventId: number; value: string }>>();

  for (const val of allValues) {
    if (!valuesByDate.has(val.date)) {
      valuesByDate.set(val.date, []);
    }
    valuesByDate.get(val.date)!.push({
      eventId: val.eventId,
      value: val.value,
    });
  }

  // Sort dates
  const sortedDates = Array.from(valuesByDate.keys()).sort();

  // Find the first date where at least one event has a non-default value
  for (const date of sortedDates) {
    const dayValues = valuesByDate.get(date)!;

    // Check if any value is non-default
    const hasMeaningfulValue = dayValues.some(val => {
      const eventType = eventTypeMap.get(val.eventId);
      if (!eventType) return false;

      return !isDefaultValue(val.value, eventType);
    });

    if (hasMeaningfulValue) {
      return date;
    }
  }

  // If no meaningful values found, return null
  return null;
}

/**
 * Get only non-default event values for a specific event
 * Optionally filter by date range starting from first meaningful date
 */
export async function getNonDefaultEventValues(
  eventId: number,
  eventType: 'boolean' | 'number' | 'string',
  startDate?: string,
  endDate?: string
): Promise<Array<{ id: number; eventId: number; date: string; value: string; timestamp: Date }>> {
  const allValues = await getAllEventValues();

  return allValues.filter(val => {
    // Filter by event ID
    if (val.eventId !== eventId) return false;

    // Filter by date range if provided
    if (startDate && val.date < startDate) return false;
    if (endDate && val.date > endDate) return false;

    // Filter out default values
    return !isDefaultValue(val.value, eventType);
  });
}

/**
 * Get all non-default event values across all events
 * Optionally filter by date range starting from first meaningful date
 */
export async function getAllNonDefaultEventValues(
  events: Event[],
  startDate?: string,
  endDate?: string
): Promise<Array<{ id: number; eventId: number; date: string; value: string; timestamp: Date }>> {
  const allValues = await getAllEventValues();
  const eventTypeMap = new Map(events.map(e => [e.id, e.type]));

  return allValues.filter(val => {
    const eventType = eventTypeMap.get(val.eventId);
    if (!eventType) return false;

    // Filter by date range if provided
    if (startDate && val.date < startDate) return false;
    if (endDate && val.date > endDate) return false;

    // Filter out default values
    return !isDefaultValue(val.value, eventType);
  });
}
