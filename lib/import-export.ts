import { getEvents, getEventValuesForDate } from '@/db/operations/events';
import type { Event } from '@/types/events';
import { storage } from './storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export interface ExportData {
  version: string;
  exportDate: string;
  events: Event[];
  eventValues: Array<{
    eventId: number;
    date: string;
    value: string;
    timestamp: string;
  }>;
  settings: {
    colorScheme?: 'light' | 'dark';
    [key: string]: any;
  };
}

/**
 * Export all data including events, values, and settings
 */
export async function exportData(): Promise<ExportData> {
  // Get all events
  const events = await getEvents();

  // Get all event values (pass empty string to get all)
  const values = await getEventValuesForDate('');
  const allEventValues = values.map((v) => ({
    eventId: v.eventId,
    date: v.date,
    value: v.value,
    timestamp: v.timestamp instanceof Date
      ? v.timestamp.toISOString()
      : typeof v.timestamp === 'string'
        ? v.timestamp
        : new Date().toISOString(),
  }));

  // Get settings from storage
  const settings: any = {};
  try {
    const colorScheme = await storage.getItem('color-scheme');
    if (colorScheme) {
      settings.colorScheme = colorScheme;
    }
  } catch (e) {
    console.warn('Could not read settings from storage:', e);
  }

  return {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    events,
    eventValues: allEventValues,
    settings,
  };
}

/**
 * Import data and restore events, values, and settings
 */
export async function importData(data: ExportData, options: {
  clearExisting?: boolean;
  onProgress?: (progress: number, message: string) => void;
} = {}): Promise<{ success: boolean; message: string }> {
  const { clearExisting = false, onProgress } = options;

  try {
    onProgress?.(0, 'Starting import...');

    // Validate data structure
    if (!data.version || !data.events || !data.eventValues) {
      throw new Error('Invalid export file format');
    }

    // Import needed operations
    const { createEvent, deleteEvent, setEventValue } = await import('@/db/operations/events');

    // Clear existing data if requested
    if (clearExisting) {
      onProgress?.(10, 'Clearing existing data...');
      const existingEvents = await getEvents();
      for (const event of existingEvents) {
        await deleteEvent(event.id);
      }
    }

    onProgress?.(20, 'Importing events...');

    // Create a mapping from old IDs to new IDs
    const idMapping: Record<number, number> = {};

    // Import events
    for (let i = 0; i < data.events.length; i++) {
      const eventData = data.events[i];
      const oldId = eventData.id;

      // Create event without ID (let DB assign new one)
      const newEvent = await createEvent({
        name: eventData.name,
        type: eventData.type,
        unit: eventData.unit ?? undefined,
        color: eventData.color,
      });

      idMapping[oldId] = newEvent.id;

      onProgress?.(
        20 + Math.floor((i / data.events.length) * 30),
        `Importing events: ${i + 1}/${data.events.length}`
      );
    }

    onProgress?.(50, 'Importing event values...');

    // Import event values with new IDs
    const totalValues = data.eventValues.length;
    const batchSize = 100;

    for (let i = 0; i < totalValues; i += batchSize) {
      const batch = data.eventValues.slice(i, Math.min(i + batchSize, totalValues));

      await Promise.all(
        batch.map(async (valueData) => {
          const newEventId = idMapping[valueData.eventId];
          if (newEventId) {
            await setEventValue(newEventId, valueData.date, valueData.value);
          }
        })
      );

      onProgress?.(
        50 + Math.floor((i / totalValues) * 40),
        `Importing values: ${Math.min(i + batchSize, totalValues)}/${totalValues}`
      );
    }

    onProgress?.(90, 'Restoring settings...');

    // Restore settings
    if (data.settings) {
      try {
        if (data.settings.colorScheme) {
          await storage.setItem('color-scheme', data.settings.colorScheme);
        }
      } catch (e) {
        console.warn('Could not restore settings:', e);
      }
    }

    onProgress?.(100, 'Import complete!');

    return {
      success: true,
      message: `Successfully imported ${data.events.length} events and ${data.eventValues.length} values`,
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Import failed',
    };
  }
}

/**
 * Download export data as JSON file (works on web, iOS, and Android)
 */
export async function downloadExportFile(data: ExportData, filename?: string) {
  const json = JSON.stringify(data, null, 2);
  const defaultFilename = filename || `life-events-backup-${new Date().toISOString().split('T')[0]}.json`;

  if (Platform.OS === 'web') {
    // Web platform: use Blob and URL
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } else {
    // iOS/Android: use FileSystem and Sharing
    const fileUri = FileSystem.documentDirectory + defaultFilename;

    try {
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save backup file',
          UTI: 'public.json',
        });
      } else {
        console.warn('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  }
}

/**
 * Read and parse import file (works on web, iOS, and Android)
 */
export async function readImportFile(file?: File): Promise<ExportData> {
  if (Platform.OS === 'web') {
    // Web platform: use FileReader
    if (!file) {
      throw new Error('File is required for web platform');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const data = JSON.parse(text);
          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse import file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  } else {
    // iOS/Android: use DocumentPicker and FileSystem
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        throw new Error('No file selected');
      }

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const data = JSON.parse(content);
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to read import file');
    }
  }
}
