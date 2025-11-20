import { webDb } from '../client.web';
import type { CreateEventInput, UpdateEventInput } from '@/types/events';

// Event CRUD Operations
export async function createEvent(input: CreateEventInput) {
  const events = await webDb.getEvents();
  const maxOrder = events.length > 0 ? Math.max(...events.map(e => e.order)) : -1;
  const order = maxOrder + 1;

  return webDb.createEvent({
    ...input,
    order,
  });
}

export async function getEvents() {
  return webDb.getEvents();
}

export async function getEventById(id: number) {
  return webDb.getEventById(id);
}

export async function updateEvent(id: number, input: UpdateEventInput) {
  return webDb.updateEvent(id, input);
}

export async function deleteEvent(id: number) {
  return webDb.deleteEvent(id);
}

export async function reorderEvents(eventIds: number[]) {
  const events = await webDb.getEvents();
  for (let i = 0; i < eventIds.length; i++) {
    const event = events.find(e => e.id === eventIds[i]);
    if (event) {
      await webDb.updateEvent(event.id, { order: i });
    }
  }
}

// Event Value Operations
export async function setEventValue(eventId: number, date: string, value: string) {
  return webDb.setEventValue(eventId, date, value);
}

export async function getEventValue(eventId: number, date: string) {
  return webDb.getEventValue(eventId, date);
}

export async function getEventValuesForDateRange(eventId: number, startDate: string, endDate: string) {
  const allValues = await webDb.getEventValuesForDate(''); // Get all
  return allValues.filter(
    v => v.eventId === eventId && v.date >= startDate && v.date <= endDate
  ).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getEventValuesForDateRangeComplete(
  eventId: number,
  startDate: string,
  endDate: string,
  eventType: 'boolean' | 'number' | 'string'
) {
  const values = await getEventValuesForDateRange(eventId, startDate, endDate);

  const valuesByDate = new Map(values.map((v) => [v.date, v]));
  const completeValues = [];

  // Generate all dates in range
  const start = new Date(startDate);
  const end = new Date(endDate);
  let currentDate = new Date(start);

  // Determine default value based on event type
  let defaultValue: string;
  if (eventType === 'boolean') {
    defaultValue = 'false';
  } else if (eventType === 'number') {
    defaultValue = '0';
  } else {
    defaultValue = ''; // string type
  }

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const existingValue = valuesByDate.get(dateStr);

    if (existingValue) {
      completeValues.push(existingValue);
    } else {
      // Create a placeholder entry for missing date with default value
      completeValues.push({
        id: -1, // Placeholder ID
        eventId,
        date: dateStr,
        value: defaultValue,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return completeValues;
}

export async function getEventValuesForDate(date: string) {
  return webDb.getEventValuesForDate(date);
}

export async function getAllEventValues() {
  return webDb.getEventValuesForDate(''); // Get all values
}

export async function deleteEventValue(eventId: number, date: string) {
  return webDb.deleteEventValue(eventId, date);
}
