import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = join(app.getPath('userData'), 'history.db')
    _db = new Database(dbPath)
    _db.pragma('journal_mode = WAL')
    migrate(_db)
  }
  return _db
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vod_history (
      vod_id                   TEXT PRIMARY KEY,
      channel_login            TEXT NOT NULL,
      title                    TEXT,
      duration_seconds         INTEGER,
      resume_position_seconds  INTEGER NOT NULL DEFAULT 0,
      watched_at               INTEGER NOT NULL,
      completed                INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_history_watched ON vod_history(watched_at DESC);
  `)
}
