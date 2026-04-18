import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { getDataDir } from "@/lib/paths";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "app.db");
  const database = new Database(file);
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 10000");
  database.pragma("foreign_keys = ON");
  migrate(database);
  db = database;
  return database;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      phase TEXT,
      video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      channel TEXT,
      url TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      error TEXT,
      output_path TEXT,
      track_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_updated ON jobs(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_video ON jobs(video_id);

    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY NOT NULL,
      video_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      artist TEXT,
      channel TEXT,
      file_path TEXT NOT NULL,
      format TEXT NOT NULL,
      duration_sec REAL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);

    CREATE TABLE IF NOT EXISTS analysis (
      track_id TEXT PRIMARY KEY NOT NULL,
      bpm REAL,
      bpm_confidence REAL,
      key_musical TEXT,
      key_camelot TEXT,
      energy REAL,
      integrated_lufs REAL,
      beats_json TEXT,
      analyzed_at TEXT NOT NULL,
      analyzer_version TEXT NOT NULL,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );
  `);
}
