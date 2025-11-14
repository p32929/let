import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  parseISO,
} from 'date-fns';

export function formatDate(date: Date, formatStr: string = 'yyyy-MM-dd'): string {
  return format(date, formatStr);
}

export function getWeekDays(date: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const start = startOfWeek(date, { weekStartsOn });
  const end = endOfWeek(date, { weekStartsOn });
  return eachDayOfInterval({ start, end });
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function getNextWeek(date: Date): Date {
  return addWeeks(date, 1);
}

export function getPreviousWeek(date: Date): Date {
  return subWeeks(date, 1);
}

export function parseDateString(dateStr: string): Date {
  return parseISO(dateStr);
}

export function getDayName(date: Date, format: 'short' | 'long' = 'short'): string {
  return format === 'short'
    ? formatDate(date, 'EEE')
    : formatDate(date, 'EEEE');
}

export function getMonthName(date: Date, format: 'short' | 'long' = 'short'): string {
  return format === 'short'
    ? formatDate(date, 'MMM')
    : formatDate(date, 'MMMM');
}
