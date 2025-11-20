import { storage } from './storage';
import { Platform } from 'react-native';

export interface ErrorReport {
  id: string;
  timestamp: string;
  error: {
    message: string;
    name: string;
    stack?: string;
  };
  context: {
    action: string;
    component?: string;
    platform: string;
    additionalInfo?: Record<string, any>;
  };
  userAgent?: string;
}

const MAX_ERROR_REPORTS = 50; // Keep last 50 errors
const ERROR_STORAGE_KEY = 'error_reports';

/**
 * Log an error and store it for later viewing
 */
export async function logError(
  error: Error | unknown,
  context: {
    action: string;
    component?: string;
    additionalInfo?: Record<string, any>;
  }
): Promise<void> {
  try {
    const errorReport: ErrorReport = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      error: {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined,
      },
      context: {
        action: context.action,
        component: context.component,
        platform: Platform.OS,
        additionalInfo: context.additionalInfo,
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    // Get existing error reports
    const existingReports = await getErrorReports();

    // Add new report at the beginning
    const updatedReports = [errorReport, ...existingReports];

    // Keep only the last MAX_ERROR_REPORTS
    const trimmedReports = updatedReports.slice(0, MAX_ERROR_REPORTS);

    // Save to storage
    await storage.setItem(ERROR_STORAGE_KEY, JSON.stringify(trimmedReports));

    // Also log to console for development
    console.error(`[ErrorTracker] ${context.action}:`, error);
    if (context.additionalInfo) {
      console.error('[ErrorTracker] Additional Info:', context.additionalInfo);
    }
  } catch (storageError) {
    // If we can't store the error, at least log it
    console.error('[ErrorTracker] Failed to store error:', storageError);
    console.error('[ErrorTracker] Original error:', error);
  }
}

/**
 * Get all stored error reports
 */
export async function getErrorReports(): Promise<ErrorReport[]> {
  try {
    const reportsJson = await storage.getItem(ERROR_STORAGE_KEY);
    if (!reportsJson) {
      return [];
    }
    return JSON.parse(reportsJson);
  } catch (error) {
    console.error('[ErrorTracker] Failed to retrieve error reports:', error);
    return [];
  }
}

/**
 * Clear all error reports
 */
export async function clearErrorReports(): Promise<void> {
  try {
    await storage.removeItem(ERROR_STORAGE_KEY);
  } catch (error) {
    console.error('[ErrorTracker] Failed to clear error reports:', error);
  }
}

/**
 * Delete a specific error report
 */
export async function deleteErrorReport(id: string): Promise<void> {
  try {
    const reports = await getErrorReports();
    const filteredReports = reports.filter((report) => report.id !== id);
    await storage.setItem(ERROR_STORAGE_KEY, JSON.stringify(filteredReports));
  } catch (error) {
    console.error('[ErrorTracker] Failed to delete error report:', error);
  }
}

/**
 * Get error count
 */
export async function getErrorCount(): Promise<number> {
  const reports = await getErrorReports();
  return reports.length;
}

/**
 * Export error reports as JSON string (for sharing/debugging)
 */
export async function exportErrorReports(): Promise<string> {
  const reports = await getErrorReports();
  return JSON.stringify(reports, null, 2);
}

/**
 * Wrapper function to execute a function and automatically log errors
 */
export async function withErrorTracking<T>(
  action: string,
  fn: () => Promise<T>,
  options?: {
    component?: string;
    additionalInfo?: Record<string, any>;
    rethrow?: boolean;
  }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await logError(error, {
      action,
      component: options?.component,
      additionalInfo: options?.additionalInfo,
    });

    if (options?.rethrow !== false) {
      throw error;
    }

    throw error;
  }
}
