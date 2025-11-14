// Web-compatible database client using localStorage as fallback
// expo-sqlite doesn't support web, so we'll use a simple in-memory/localStorage solution

import type { Event, EventValue, InsertEvent, InsertEventValue } from './schemas/events';

class WebDatabase {
  private events: Event[] = [];
  private eventValues: EventValue[] = [];
  private nextEventId = 1;
  private nextValueId = 1;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      const eventsStr = localStorage.getItem('life-events-tracker-events');
      const valuesStr = localStorage.getItem('life-events-tracker-values');

      if (eventsStr) {
        this.events = JSON.parse(eventsStr);
        this.nextEventId = Math.max(...this.events.map(e => e.id), 0) + 1;
      }

      if (valuesStr) {
        this.eventValues = JSON.parse(valuesStr);
        this.nextValueId = Math.max(...this.eventValues.map(v => v.id), 0) + 1;
      }
    }
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('life-events-tracker-events', JSON.stringify(this.events));
      localStorage.setItem('life-events-tracker-values', JSON.stringify(this.eventValues));
    }
  }

  // Events operations
  async getEvents(): Promise<Event[]> {
    return [...this.events].sort((a, b) => a.order - b.order);
  }

  async getEventById(id: number): Promise<Event | undefined> {
    return this.events.find(e => e.id === id);
  }

  async createEvent(data: Omit<InsertEvent, 'id'>): Promise<Event> {
    const event: Event = {
      id: this.nextEventId++,
      name: data.name,
      type: data.type,
      unit: data.unit || null,
      color: data.color || '#3b82f6',
      icon: data.icon || null,
      order: data.order ?? this.events.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.events.push(event);
    this.saveToStorage();
    return event;
  }

  async updateEvent(id: number, data: Partial<Omit<Event, 'id' | 'createdAt'>>): Promise<Event | undefined> {
    const index = this.events.findIndex(e => e.id === id);
    if (index === -1) return undefined;

    this.events[index] = {
      ...this.events[index],
      ...data,
      updatedAt: new Date(),
    };
    this.saveToStorage();
    return this.events[index];
  }

  async deleteEvent(id: number): Promise<void> {
    this.events = this.events.filter(e => e.id !== id);
    this.eventValues = this.eventValues.filter(v => v.eventId !== id);
    this.saveToStorage();
  }

  // Event values operations
  async getEventValue(eventId: number, date: string): Promise<EventValue | undefined> {
    return this.eventValues.find(v => v.eventId === eventId && v.date === date);
  }

  async setEventValue(eventId: number, date: string, value: string): Promise<EventValue> {
    const existing = this.eventValues.find(v => v.eventId === eventId && v.date === date);

    if (existing) {
      existing.value = value;
      existing.timestamp = new Date();
      existing.updatedAt = new Date();
      this.saveToStorage();
      return existing;
    }

    const eventValue: EventValue = {
      id: this.nextValueId++,
      eventId,
      date,
      value,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.eventValues.push(eventValue);
    this.saveToStorage();
    return eventValue;
  }

  async getEventValuesForDate(date: string): Promise<EventValue[]> {
    return this.eventValues.filter(v => v.date === date);
  }

  async deleteEventValue(eventId: number, date: string): Promise<void> {
    this.eventValues = this.eventValues.filter(
      v => !(v.eventId === eventId && v.date === date)
    );
    this.saveToStorage();
  }
}

// Export a singleton instance
export const webDb = new WebDatabase();

// Mock drizzle-style db object for compatibility
export const db = {
  select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
  insert: () => ({ values: () => ({ returning: () => [] }) }),
  update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
  delete: () => ({ where: () => Promise.resolve() }),
  run: () => Promise.resolve(),
} as any;
