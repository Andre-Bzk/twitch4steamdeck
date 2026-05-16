import { getDb } from './db'

export interface VodHistoryEntry {
  vod_id: string
  channel_login: string
  title: string | null
  duration_seconds: number | null
  resume_position_seconds: number
  watched_at: number
  completed: number
}

export function upsertVod(entry: Omit<VodHistoryEntry, 'resume_position_seconds' | 'completed'>): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO vod_history (vod_id, channel_login, title, duration_seconds, watched_at)
    VALUES (@vod_id, @channel_login, @title, @duration_seconds, @watched_at)
    ON CONFLICT(vod_id) DO UPDATE SET
      watched_at = excluded.watched_at,
      title = excluded.title,
      duration_seconds = excluded.duration_seconds
  `).run(entry)
}

export function updatePosition(vodId: string, positionSeconds: number): void {
  getDb()
    .prepare(
      `UPDATE vod_history SET resume_position_seconds = ? WHERE vod_id = ?`
    )
    .run(positionSeconds, vodId)
}

export function markCompleted(vodId: string): void {
  getDb()
    .prepare(`UPDATE vod_history SET completed = 1 WHERE vod_id = ?`)
    .run(vodId)
}

export interface VodProgress {
  resumePositionSeconds: number
  watchedAt: number
  completed: boolean
}

/** Returns existing history entries for all passed vodIds. */
export function getProgressMap(vodIds: string[]): Record<string, VodProgress> {
  if (vodIds.length === 0) return {}
  const placeholders = vodIds.map(() => '?').join(',')
  const rows = getDb()
    .prepare(
      `SELECT vod_id, resume_position_seconds, watched_at, completed
       FROM vod_history WHERE vod_id IN (${placeholders})`
    )
    .all(...vodIds) as {
      vod_id: string
      resume_position_seconds: number
      watched_at: number
      completed: number
    }[]
  const map: Record<string, VodProgress> = {}
  for (const r of rows) {
    map[r.vod_id] = {
      resumePositionSeconds: r.resume_position_seconds,
      watchedAt: r.watched_at,
      completed: r.completed === 1
    }
  }
  return map
}

export function getPosition(vodId: string): number {
  const row = getDb()
    .prepare(
      `SELECT resume_position_seconds, completed FROM vod_history WHERE vod_id = ?`
    )
    .get(vodId) as { resume_position_seconds: number; completed: number } | undefined
  // Completed VODs: start from beginning
  if (!row || row.completed) return 0
  return row.resume_position_seconds
}
