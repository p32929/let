import { getDatabase } from '../sqlite/client';
import type { Event, EventValue, EventType } from '@/types/events';

// ==================== EVENT OPERATIONS ====================

export async function createEvent(data: {
  name: string;
  type: EventType;
  unit?: string;
  color?: string;
  icon?: string;
}): Promise<Event> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `INSERT INTO events (name, type, unit, color, icon, "order")
     VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX("order"), -1) + 1 FROM events))`,
    [data.name, data.type, data.unit || null, data.color || '#3b82f6', data.icon || null]
  );

  const event = await db.getFirstAsync<Event>(
    'SELECT * FROM events WHERE id = ?',
    [result.lastInsertRowId]
  );

  if (!event) {
    throw new Error('Failed to create event');
  }

  return event;
}

export async function getEvents(): Promise<Event[]> {
  const db = await getDatabase();
  const events = await db.getAllAsync<Event>('SELECT * FROM events ORDER BY "order" ASC');
  return events;
}

export async function getEventById(id: number): Promise<Event | null> {
  const db = await getDatabase();
  const event = await db.getFirstAsync<Event>('SELECT * FROM events WHERE id = ?', [id]);
  return event || null;
}

export async function updateEvent(
  id: number,
  data: {
    name?: string;
    type?: EventType;
    unit?: string;
    color?: string;
    icon?: string;
  }
): Promise<Event> {
  const db = await getDatabase();

  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.type !== undefined) {
    updates.push('type = ?');
    values.push(data.type);
  }
  if (data.unit !== undefined) {
    updates.push('unit = ?');
    values.push(data.unit || null);
  }
  if (data.color !== undefined) {
    updates.push('color = ?');
    values.push(data.color);
  }
  if (data.icon !== undefined) {
    updates.push('icon = ?');
    values.push(data.icon || null);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await db.runAsync(
    `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  const event = await getEventById(id);
  if (!event) {
    throw new Error('Event not found after update');
  }

  return event;
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM events WHERE id = ?', [id]);
}

export async function reorderEvents(eventIds: number[]): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < eventIds.length; i++) {
      await db.runAsync(
        'UPDATE events SET "order" = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [i, eventIds[i]]
      );
    }
  });
}

// ==================== EVENT VALUE OPERATIONS ====================

export async function setEventValue(
  eventId: number,
  date: string,
  value: string
): Promise<EventValue> {
  const db = await getDatabase();

  // Use INSERT OR REPLACE to handle both insert and update
  await db.runAsync(
    `INSERT INTO event_values (event_id, date, value, timestamp)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(event_id, date)
     DO UPDATE SET value = ?, timestamp = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
    [eventId, date, value, value]
  );

  const eventValue = await db.getFirstAsync<EventValue>(
    'SELECT * FROM event_values WHERE event_id = ? AND date = ?',
    [eventId, date]
  );

  if (!eventValue) {
    throw new Error('Failed to set event value');
  }

  return eventValue;
}

export async function getEventValue(
  eventId: number,
  date: string
): Promise<EventValue | null> {
  const db = await getDatabase();
  const eventValue = await db.getFirstAsync<EventValue>(
    'SELECT * FROM event_values WHERE event_id = ? AND date = ?',
    [eventId, date]
  );
  return eventValue || null;
}

export async function getEventValuesForDateRange(
  eventId: number,
  startDate: string,
  endDate: string
): Promise<EventValue[]> {
  const db = await getDatabase();
  const values = await db.getAllAsync<EventValue>(
    'SELECT * FROM event_values WHERE event_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC',
    [eventId, startDate, endDate]
  );
  return values;
}

export async function getEventValuesForDateRangeComplete(
  startDate: string,
  endDate: string
): Promise<EventValue[]> {
  const db = await getDatabase();
  const values = await db.getAllAsync<EventValue>(
    'SELECT * FROM event_values WHERE date BETWEEN ? AND ? ORDER BY date ASC, event_id ASC',
    [startDate, endDate]
  );
  return values;
}

export async function getEventValuesForDate(date: string): Promise<EventValue[]> {
  const db = await getDatabase();

  // If date is empty string, return all event values
  if (date === '') {
    const values = await db.getAllAsync<EventValue>(
      'SELECT * FROM event_values ORDER BY date DESC, event_id ASC'
    );
    return values;
  }

  const values = await db.getAllAsync<EventValue>(
    'SELECT * FROM event_values WHERE date = ? ORDER BY event_id ASC',
    [date]
  );
  return values;
}

export async function getAllEventValues(): Promise<EventValue[]> {
  const db = await getDatabase();
  const values = await db.getAllAsync<EventValue>(
    'SELECT * FROM event_values ORDER BY date DESC, event_id ASC'
  );
  return values;
}

export async function deleteEventValue(eventId: number, date: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM event_values WHERE event_id = ? AND date = ?', [eventId, date]);
}
