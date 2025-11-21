import type { Event } from '@/types/events';

/**
 * Check if a value is a PLACEHOLDER (not actually tracked by user)
 *
 * getEventValuesForDateRangeComplete creates placeholder records with id: -1
 * for missing dates. This is the ONLY reliable way to know if a value was
 * actually tracked or just filled in as a placeholder.
 *
 * Note: boolean false and number 0 are MEANINGFUL tracked values, not defaults!
 */
export function isPlaceholderValue(record: { id: number }): boolean {
  return record.id === -1;
}

/**
 * @deprecated Use isPlaceholderValue instead
 * This function incorrectly treats boolean false and number 0 as defaults
 */
export function isDefaultValue(value: string, eventType: 'boolean' | 'number' | 'string'): boolean {
  // For strings, empty is truly untracked
  if (eventType === 'string') {
    return value === '' || value.trim() === '';
  }
  // For booleans and numbers, we can't tell from the value alone
  // Use isPlaceholderValue instead
  return false;
}
