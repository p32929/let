// Web migration - just ensures localStorage is available
export async function migrateDatabase() {
  if (typeof window === 'undefined') {
    console.warn('Not in browser environment, skipping web migration');
    return;
  }

  try {
    // Check if localStorage is available
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    console.log('Web storage initialized successfully');
  } catch (error) {
    console.error('localStorage not available:', error);
    throw new Error('Web storage not available');
  }
}
