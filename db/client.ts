import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schemas/events';

const expo = openDatabaseSync('life-events.db');
export const db = drizzle(expo, { schema });
