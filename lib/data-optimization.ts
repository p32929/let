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
