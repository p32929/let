import { db } from '../client';
import { events, eventValues } from '../schemas/events';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type { CreateEventInput, UpdateEventInput } from '@/types/events';

// Event CRUD Operations
export async function createEvent(input: CreateEventInput) {
  const maxOrder = await db
    .select({ maxOrder: events.order })
    .from(events)
    .orderBy(desc(events.order))
    .limit(1);

  const order = (maxOrder[0]?.maxOrder ?? -1) + 1;

  const [event] = await db
    .insert(events)
    .values({
      ...input,
      order,
    })
    .returning();

  return event;
}

export async function getEvents() {
  return db.select().from(events).orderBy(asc(events.order));
}

export async function getEventById(id: number) {
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return event;
}

export async function updateEvent(id: number, input: UpdateEventInput) {
  const [updated] = await db
    .update(events)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(events.id, id))
    .returning();

  return updated;
}

export async function deleteEvent(id: number) {
  await db.delete(events).where(eq(events.id, id));
}

export async function reorderEvents(eventIds: number[]) {
  // Update order for each event based on array position
  const updates = eventIds.map((id, index) =>
    db
      .update(events)
      .set({ order: index, updatedAt: new Date() })
      .where(eq(events.id, id))
  );

  await Promise.all(updates);
}

// Event Value Operations
export async function setEventValue(eventId: number, date: string, value: string) {
  // Check if value exists for this event and date
  const [existing] = await db
    .select()
    .from(eventValues)
    .where(and(eq(eventValues.eventId, eventId), eq(eventValues.date, date)))
    .limit(1);

  if (existing) {
    // Update existing value
    const [updated] = await db
      .update(eventValues)
      .set({
        value,
        timestamp: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eventValues.id, existing.id))
      .returning();

    return updated;
  } else {
    // Create new value
    const [created] = await db
      .insert(eventValues)
      .values({
        eventId,
        date,
        value,
      })
      .returning();

    return created;
  }
}

export async function getEventValue(eventId: number, date: string) {
  const [value] = await db
    .select()
    .from(eventValues)
    .where(and(eq(eventValues.eventId, eventId), eq(eventValues.date, date)))
    .limit(1);

  return value;
}

export async function getEventValuesForDateRange(eventId: number, startDate: string, endDate: string) {
  return db
    .select()
    .from(eventValues)
    .where(
      and(
        eq(eventValues.eventId, eventId),
        sql`${eventValues.date} >= ${startDate} AND ${eventValues.date} <= ${endDate}`
      )
    )
    .orderBy(asc(eventValues.date));
}

export async function getEventValuesForDate(date: string) {
  // If empty string, return all values
  if (date === '') {
    return db.select().from(eventValues).orderBy(asc(eventValues.eventId));
  }

  return db
    .select()
    .from(eventValues)
    .where(eq(eventValues.date, date))
    .orderBy(asc(eventValues.eventId));
}

export async function getAllEventValues() {
  return db.select().from(eventValues).orderBy(asc(eventValues.eventId));
}

export async function deleteEventValue(eventId: number, date: string) {
  await db
    .delete(eventValues)
    .where(and(eq(eventValues.eventId, eventId), eq(eventValues.date, date)));
}
