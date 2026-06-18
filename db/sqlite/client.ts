import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

// Bump this whenever the schema changes, then add a matching `case` in runMigrations().
// This lets us safely update existing users' databases instead of risking data loss.
const SCHEMA_VERSION = 1;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync('life-events.db');

  // Make sure foreign-key cascades (e.g. deleting an event removes its values) are enforced.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Create tables if they don't exist
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      unit TEXT,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      icon TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      value TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
      UNIQUE(event_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_event_values_event_id ON event_values(event_id);
    CREATE INDEX IF NOT EXISTS idx_event_values_date ON event_values(date);
    CREATE INDEX IF NOT EXISTS idx_events_order ON events("order");
  `);

  await runMigrations(db);

  return db;
}

/**
 * Step an existing database forward to the current SCHEMA_VERSION.
 * Each new schema change adds a `case` below that upgrades from the previous version.
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < SCHEMA_VERSION) {
    switch (version) {
      // case 1: await database.execAsync('ALTER TABLE events ADD COLUMN notes TEXT'); break;
      default:
        break;
    }
    version += 1;
  }

  // PRAGMA doesn't accept bound parameters, so the value is inlined (it's our own constant).
  await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
