export type EventType = 'boolean' | 'number' | 'string';

export interface Event {
  id: number;
  name: string;
  type: EventType;
  unit?: string | null;
  color: string;
  icon?: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventValue {
  id: number;
  eventId: number;
  date: string; // YYYY-MM-DD format
  value: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEventInput {
  name: string;
  type: EventType;
  unit?: string;
  color?: string;
  icon?: string;
}

export interface UpdateEventInput {
  name?: string;
  type?: EventType;
  unit?: string;
  color?: string;
  icon?: string;
  order?: number;
}

export interface EventWithValue extends Event {
  value?: EventValue;
}
