import { db } from './client';
import { sql } from 'drizzle-orm';

export async function migrateDatabase() {
  try {
    // Create events table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('boolean', 'number', 'string')),
        unit TEXT,
        color TEXT DEFAULT '#3b82f6',
        icon TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create event_values table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS event_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_event_values_event_id
      ON event_values(event_id)
    `);

    await db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_event_values_date
      ON event_values(date)
    `);

    await db.run(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_event_values_unique
      ON event_values(event_id, date)
    `);

    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
}
