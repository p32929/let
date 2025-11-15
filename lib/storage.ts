// Storage abstraction that works on both web and mobile
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class Storage {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.clear();
      return;
    }
    await AsyncStorage.clear();
  }
}

export const storage = new Storage();
