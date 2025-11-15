// Web-compatible database client using AsyncStorage
// expo-sqlite doesn't support web, so we'll use a simple in-memory/AsyncStorage solution

import type { Event, EventValue, InsertEvent, InsertEventValue } from './schemas/events';
import { storage } from '@/lib/storage';

class WebDatabase {
  private events: Event[] = [];
  private eventValues: EventValue[] = [];
  private nextEventId = 1;
  private nextValueId = 1;
  private initialized = false;

  async init() {
    if (!this.initialized) {
      await this.loadFromStorage();
      this.initialized = true;
    }
  }

  private async loadFromStorage() {
    const eventsStr = await storage.getItem('life-events-tracker-events');
    const valuesStr = await storage.getItem('life-events-tracker-values');

    if (eventsStr) {
      this.events = JSON.parse(eventsStr);
      this.nextEventId = Math.max(...this.events.map(e => e.id), 0) + 1;
    }

    if (valuesStr) {
      this.eventValues = JSON.parse(valuesStr);
      this.nextValueId = Math.max(...this.eventValues.map(v => v.id), 0) + 1;
    }
  }

  private async saveToStorage() {
    await storage.setItem('life-events-tracker-events', JSON.stringify(this.events));
    await storage.setItem('life-events-tracker-values', JSON.stringify(this.eventValues));
  }

  // Events operations
  async getEvents(): Promise<Event[]> {
    await this.init();
    return [...this.events].sort((a, b) => a.order - b.order);
  }

  async getEventById(id: number): Promise<Event | undefined> {
    await this.init();
    return this.events.find(e => e.id === id);
  }

  async createEvent(data: Omit<InsertEvent, 'id'>): Promise<Event> {
    await this.init();
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
    await this.saveToStorage();
    return event;
  }

  async updateEvent(id: number, data: Partial<Omit<Event, 'id' | 'createdAt'>>): Promise<Event | undefined> {
    await this.init();
    const index = this.events.findIndex(e => e.id === id);
    if (index === -1) return undefined;

    this.events[index] = {
      ...this.events[index],
      ...data,
      updatedAt: new Date(),
    };
    await this.saveToStorage();
    return this.events[index];
  }

  async deleteEvent(id: number): Promise<void> {
    await this.init();
    this.events = this.events.filter(e => e.id !== id);
    this.eventValues = this.eventValues.filter(v => v.eventId !== id);
    await this.saveToStorage();
  }

  // Event values operations
  async getEventValue(eventId: number, date: string): Promise<EventValue | undefined> {
    await this.init();
    return this.eventValues.find(v => v.eventId === eventId && v.date === date);
  }

  async setEventValue(eventId: number, date: string, value: string): Promise<EventValue> {
    await this.init();
    const existing = this.eventValues.find(v => v.eventId === eventId && v.date === date);

    if (existing) {
      existing.value = value;
      existing.timestamp = new Date();
      existing.updatedAt = new Date();
      await this.saveToStorage();
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
    await this.saveToStorage();
    return eventValue;
  }

  async getEventValuesForDate(date: string): Promise<EventValue[]> {
    await this.init();
    if (date === '') return this.eventValues; // Return all if empty string
    return this.eventValues.filter(v => v.date === date);
  }

  async getAllEventValues(): Promise<EventValue[]> {
    await this.init();
    return [...this.eventValues];
  }

  async deleteEventValue(eventId: number, date: string): Promise<void> {
    await this.init();
    this.eventValues = this.eventValues.filter(
      v => !(v.eventId === eventId && v.date === date)
    );
    await this.saveToStorage();
  }

  // Batch operations for better performance
  async batchSetEventValues(values: Array<{ eventId: number; date: string; value: string }>): Promise<void> {
    await this.init();

    for (const { eventId, date, value } of values) {
      const existing = this.eventValues.find(v => v.eventId === eventId && v.date === date);

      if (existing) {
        existing.value = value;
        existing.timestamp = new Date();
        existing.updatedAt = new Date();
      } else {
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
      }
    }

    // Save once at the end instead of after each value
    await this.saveToStorage();
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
