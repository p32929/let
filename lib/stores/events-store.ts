import { create } from 'zustand';
import type { Event, EventWithValue } from '@/types/events';
import { getEvents, getEventValuesForDate } from '@/db/operations/events';
import { format } from 'date-fns';

interface EventsState {
  events: Event[];
  selectedDate: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadEvents: () => Promise<void>;
  setSelectedDate: (date: Date) => void;
  refreshEvents: () => Promise<void>;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  isLoading: false,
  error: null,

  loadEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const events = await getEvents();
      set({ events, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load events',
        isLoading: false,
      });
    }
  },

  setSelectedDate: (date: Date) => {
    set({ selectedDate: format(date, 'yyyy-MM-dd') });
  },

  refreshEvents: async () => {
    await get().loadEvents();
  },
}));
