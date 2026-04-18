import crypto from "node:crypto";
import fs from "node:fs";

import type { AnalysisRecord } from "@/lib/analyze-track";
import type { DownloadSettings } from "@/lib/download-settings-schema";
import { getDb } from "@/lib/db";

export type JobStatus =
  | "queued"
  | "downloading"
  | "converting"
  | "analyzing"
  | "done"
  | "failed"
  | "cancelled";

export type JobRow = {
  id: string;
  status: JobStatus;
  phase: string | null;
  videoId: string;
  title: string;
  channel: string;
  url: string;
  settings: DownloadSettings;
  progress: number;
  error: string | null;
  outputPath: string | null;
  trackId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryRow = {
  id: string;
  videoId: string;
  title: string;
  artist: string | null;
  channel: string | null;
  filePath: string;
  format: string;
  durationSec: number | null;
  bpm: number | null;
  keyCamelot: string | null;
  keyMusical: string | null;
  energy: number | null;
  createdAt: string;
};

function rowToJob(r: Record<string, unknown>): JobRow {
  return {
    id: String(r.id),
    status: r.status as JobStatus,
    phase: r.phase ? String(r.phase) : null,
    videoId: String(r.video_id),
    title: String(r.title),
    channel: String(r.channel ?? ""),
    url: String(r.url),
    settings: JSON.parse(String(r.settings_json)) as DownloadSettings,
    progress: Number(r.progress ?? 0),
    error: r.error ? String(r.error) : null,
    outputPath: r.output_path ? String(r.output_path) : null,
    trackId: r.track_id ? String(r.track_id) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function listJobs(limit = 200): JobRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM jobs ORDER BY datetime(updated_at) DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToJob);
}

export function getJob(id: string): JobRow | null {
  const db = getDb();
  const r = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return r ? rowToJob(r) : null;
}

export function insertJob(row: {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  url: string;
  settings: DownloadSettings;
}): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO jobs (id, status, phase, video_id, title, channel, url, settings_json, progress, error, output_path, track_id, created_at, updated_at)
     VALUES (@id, 'queued', NULL, @video_id, @title, @channel, @url, @settings_json, 0, NULL, NULL, NULL, @created_at, @updated_at)`,
  ).run({
    id: row.id,
    video_id: row.videoId,
    title: row.title,
    channel: row.channel,
    url: row.url,
    settings_json: JSON.stringify(row.settings),
    created_at: now,
    updated_at: now,
  });
}

export function updateJob(
  id: string,
  patch: Partial<{
    status: JobStatus;
    phase: string | null;
    progress: number;
    error: string | null;
    outputPath: string | null;
    trackId: string | null;
  }>,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = @updated_at"];
  const params: Record<string, unknown> = { id, updated_at: now };

  if (patch.status !== undefined) {
    fields.push("status = @status");
    params.status = patch.status;
  }
  if (patch.phase !== undefined) {
    fields.push("phase = @phase");
    params.phase = patch.phase;
  }
  if (patch.progress !== undefined) {
    fields.push("progress = @progress");
    params.progress = patch.progress;
  }
  if (patch.error !== undefined) {
    fields.push("error = @error");
    params.error = patch.error;
  }
  if (patch.outputPath !== undefined) {
    fields.push("output_path = @output_path");
    params.output_path = patch.outputPath;
  }
  if (patch.trackId !== undefined) {
    fields.push("track_id = @track_id");
    params.track_id = patch.trackId;
  }

  db.prepare(`UPDATE jobs SET ${fields.join(", ")} WHERE id = @id`).run(
    params as Record<string, string | number | null>,
  );
}

export function deleteJob(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM jobs WHERE id = ?`).run(id);
}

export function upsertTrackWithAnalysis(input: {
  jobId: string;
  videoId: string;
  title: string;
  channel: string;
  filePath: string;
  format: string;
  durationSec: number | null;
  analysis: {
    bpm: number;
    bpmConfidence: number;
    keyMusical: string;
    keyCamelot: string;
    energy: number;
    integratedLufs: number | null;
    beatsJson: string;
    analyzerVersion: string;
  };
}): string {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare(`SELECT id FROM tracks WHERE video_id = ?`)
    .get(input.videoId) as { id: string } | undefined;
  const trackId = existing?.id ?? crypto.randomUUID();

  if (existing) {
    db.prepare(
      `UPDATE tracks SET title = @title, artist = @artist, channel = @channel, file_path = @file_path, format = @format, duration_sec = @duration_sec WHERE id = @id`,
    ).run({
      id: trackId,
      title: input.title,
      artist: input.channel,
      channel: input.channel,
      file_path: input.filePath,
      format: input.format,
      duration_sec: input.durationSec,
    });
  } else {
    db.prepare(
      `INSERT INTO tracks (id, video_id, title, artist, channel, file_path, format, duration_sec, created_at)
       VALUES (@id, @video_id, @title, @artist, @channel, @file_path, @format, @duration_sec, @created_at)`,
    ).run({
      id: trackId,
      video_id: input.videoId,
      title: input.title,
      artist: input.channel,
      channel: input.channel,
      file_path: input.filePath,
      format: input.format,
      duration_sec: input.durationSec,
      created_at: now,
    });
  }

  db.prepare(
    `INSERT INTO analysis (track_id, bpm, bpm_confidence, key_musical, key_camelot, energy, integrated_lufs, beats_json, analyzed_at, analyzer_version)
     VALUES (@track_id, @bpm, @bpm_confidence, @key_musical, @key_camelot, @energy, @integrated_lufs, @beats_json, @analyzed_at, @analyzer_version)
     ON CONFLICT(track_id) DO UPDATE SET
       bpm = excluded.bpm,
       bpm_confidence = excluded.bpm_confidence,
       key_musical = excluded.key_musical,
       key_camelot = excluded.key_camelot,
       energy = excluded.energy,
       integrated_lufs = excluded.integrated_lufs,
       beats_json = excluded.beats_json,
       analyzed_at = excluded.analyzed_at,
       analyzer_version = excluded.analyzer_version`,
  ).run({
    track_id: trackId,
    bpm: input.analysis.bpm,
    bpm_confidence: input.analysis.bpmConfidence,
    key_musical: input.analysis.keyMusical,
    key_camelot: input.analysis.keyCamelot,
    energy: input.analysis.energy,
    integrated_lufs: input.analysis.integratedLufs,
    beats_json: input.analysis.beatsJson,
    analyzed_at: now,
    analyzer_version: input.analysis.analyzerVersion,
  });

  db.prepare(`UPDATE jobs SET track_id = ?, updated_at = ? WHERE id = ?`).run(
    trackId,
    now,
    input.jobId,
  );

  return trackId;
}

export function replaceAnalysisForTrack(
  trackId: string,
  analysis: AnalysisRecord,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO analysis (track_id, bpm, bpm_confidence, key_musical, key_camelot, energy, integrated_lufs, beats_json, analyzed_at, analyzer_version)
     VALUES (@track_id, @bpm, @bpm_confidence, @key_musical, @key_camelot, @energy, @integrated_lufs, @beats_json, @analyzed_at, @analyzer_version)
     ON CONFLICT(track_id) DO UPDATE SET
       bpm = excluded.bpm,
       bpm_confidence = excluded.bpm_confidence,
       key_musical = excluded.key_musical,
       key_camelot = excluded.key_camelot,
       energy = excluded.energy,
       integrated_lufs = excluded.integrated_lufs,
       beats_json = excluded.beats_json,
       analyzed_at = excluded.analyzed_at,
       analyzer_version = excluded.analyzer_version`,
  ).run({
    track_id: trackId,
    bpm: analysis.bpm,
    bpm_confidence: analysis.bpmConfidence,
    key_musical: analysis.keyMusical,
    key_camelot: analysis.keyCamelot,
    energy: analysis.energy,
    integrated_lufs: analysis.integratedLufs,
    beats_json: analysis.beatsJson,
    analyzed_at: now,
    analyzer_version: analysis.analyzerVersion,
  });
}

export function listLibrary(filters: {
  q?: string;
  bpmMin?: number;
  bpmMax?: number;
  key?: string;
}): LibraryRow[] {
  const db = getDb();
  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];

  if (filters.q) {
    where.push("(t.title LIKE ? OR t.channel LIKE ?)");
    const q = `%${filters.q}%`;
    params.push(q, q);
  }
  if (filters.bpmMin != null) {
    where.push("a.bpm >= ?");
    params.push(filters.bpmMin);
  }
  if (filters.bpmMax != null) {
    where.push("a.bpm <= ?");
    params.push(filters.bpmMax);
  }
  if (filters.key) {
    where.push("(a.key_camelot = ? OR a.key_musical = ?)");
    params.push(filters.key, filters.key);
  }

  const sql = `
    SELECT t.id, t.video_id, t.title, t.artist, t.channel, t.file_path, t.format, t.duration_sec,
           a.bpm, a.key_camelot, a.key_musical, a.energy, t.created_at
    FROM tracks t
    LEFT JOIN analysis a ON a.track_id = t.id
    WHERE ${where.join(" AND ")}
    ORDER BY datetime(t.created_at) DESC
  `;

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    videoId: String(r.video_id),
    title: String(r.title),
    artist: r.artist ? String(r.artist) : null,
    channel: r.channel ? String(r.channel) : null,
    filePath: String(r.file_path),
    format: String(r.format),
    durationSec:
      r.duration_sec == null ? null : Number(r.duration_sec),
    bpm: r.bpm == null ? null : Number(r.bpm),
    keyCamelot: r.key_camelot ? String(r.key_camelot) : null,
    keyMusical: r.key_musical ? String(r.key_musical) : null,
    energy: r.energy == null ? null : Number(r.energy),
    createdAt: String(r.created_at),
  }));
}

export function getTrackById(id: string): LibraryRow | null {
  const db = getDb();
  const r = db
    .prepare(
      `
    SELECT t.id, t.video_id, t.title, t.artist, t.channel, t.file_path, t.format, t.duration_sec,
           a.bpm, a.key_camelot, a.key_musical, a.energy, t.created_at
    FROM tracks t
    LEFT JOIN analysis a ON a.track_id = t.id
    WHERE t.id = ?
  `,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    videoId: String(r.video_id),
    title: String(r.title),
    artist: r.artist ? String(r.artist) : null,
    channel: r.channel ? String(r.channel) : null,
    filePath: String(r.file_path),
    format: String(r.format),
    durationSec:
      r.duration_sec == null ? null : Number(r.duration_sec),
    bpm: r.bpm == null ? null : Number(r.bpm),
    keyCamelot: r.key_camelot ? String(r.key_camelot) : null,
    keyMusical: r.key_musical ? String(r.key_musical) : null,
    energy: r.energy == null ? null : Number(r.energy),
    createdAt: String(r.created_at),
  };
}

export function deleteTrack(id: string): boolean {
  const db = getDb();
  const row = db.prepare(`SELECT file_path FROM tracks WHERE id = ?`).get(id) as
    | { file_path: string }
    | undefined;
  if (!row) return false;
  try {
    fs.unlinkSync(row.file_path);
  } catch {
    // ignore missing file
  }
  db.prepare(`DELETE FROM tracks WHERE id = ?`).run(id);
  return true;
}
