import { spawn } from "node:child_process";

import type { YoutubeSearchQuery } from "@/lib/youtube-search-schema";

export type YoutubeSearchResultItem = {
  videoId: string;
  title: string;
  channel: string;
  durationSec: number | null;
  thumb: string | null;
  viewCount: number | null;
  publishedAt: string | null;
  url: string;
};

type DurationFilter = YoutubeSearchQuery["duration"];

type YtFlatEntry = {
  _type?: string;
  id?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number | null;
  view_count?: number | null;
  thumbnail?: string | null;
  thumbnails?: Array<{ url?: string; width?: number }>;
  webpage_url?: string;
  url?: string;
  upload_date?: string | null;
  entries?: YtFlatEntry[];
};

function formatUploadDate(uploadDate: string | null | undefined): string | null {
  if (!uploadDate || uploadDate.length !== 8) return null;
  const y = uploadDate.slice(0, 4);
  const m = uploadDate.slice(4, 6);
  const d = uploadDate.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function pickThumb(entry: YtFlatEntry): string | null {
  const list = entry.thumbnails;
  if (Array.isArray(list) && list.length > 0) {
    const sorted = [...list].sort(
      (a, b) => (b.width ?? 0) - (a.width ?? 0),
    );
    const url = sorted[0]?.url;
    if (url) return url;
  }
  if (typeof entry.thumbnail === "string" && entry.thumbnail.length > 0) {
    return entry.thumbnail;
  }
  return null;
}

function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function matchesDuration(
  sec: number | null | undefined,
  filter: DurationFilter,
): boolean {
  if (filter === "any") return true;
  if (sec == null || Number.isNaN(sec)) return true;
  if (filter === "short") return sec < 240;
  if (filter === "medium") return sec >= 240 && sec <= 1200;
  return sec > 1200;
}

function parseNdjson(stdout: string): YtFlatEntry[] {
  const lines = stdout.split(/\r?\n/);
  const out: YtFlatEntry[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as YtFlatEntry;
      if (obj._type === "playlist" && Array.isArray(obj.entries)) {
        out.push(...obj.entries);
      } else {
        out.push(obj);
      }
    } catch {
      // skip malformed lines (progress noise, etc.)
    }
  }
  return out;
}

function mapEntry(entry: YtFlatEntry): YoutubeSearchResultItem | null {
  const id = entry.id;
  const title = entry.title;
  if (!id || !title) return null;

  const channel = entry.channel ?? entry.uploader ?? "";
  const durationSec =
    typeof entry.duration === "number" && !Number.isNaN(entry.duration)
      ? entry.duration
      : null;
  const viewCount =
    typeof entry.view_count === "number" && !Number.isNaN(entry.view_count)
      ? entry.view_count
      : null;

  const url =
    typeof entry.webpage_url === "string" && entry.webpage_url.length > 0
      ? entry.webpage_url
      : typeof entry.url === "string" && entry.url.startsWith("http")
        ? entry.url
        : watchUrl(id);

  return {
    videoId: id,
    title,
    channel,
    durationSec,
    thumb: pickThumb(entry),
    viewCount,
    publishedAt: formatUploadDate(entry.upload_date ?? undefined),
    url,
  };
}

function runYtDlpSearch(query: string, max: number): Promise<{
  stdout: string;
  stderr: string;
  code: number | null;
}> {
  const target = `ytsearch${max}:${query}`;
  const args = ["--dump-json", "--flat-playlist", "--no-warnings", target];

  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      reject(err);
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

export async function searchYoutube(
  query: string,
  max: number,
  duration: DurationFilter,
): Promise<YoutubeSearchResultItem[]> {
  let stdout: string;
  let stderr: string;
  let code: number | null;

  try {
    const result = await runYtDlpSearch(query, max);
    stdout = result.stdout;
    stderr = result.stderr;
    code = result.code;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      throw new Error(
        "yt-dlp not found on PATH. Install yt-dlp and ensure it is available to the API process.",
      );
    }
    throw err;
  }

  if (code !== 0) {
    const detail = stderr.trim() || `exit code ${code}`;
    throw new Error(`yt-dlp failed: ${detail}`);
  }

  const flat = parseNdjson(stdout);
  const mapped: YoutubeSearchResultItem[] = [];

  for (const entry of flat) {
    const row = mapEntry(entry);
    if (!row) continue;
    if (!matchesDuration(row.durationSec, duration)) continue;
    mapped.push(row);
  }

  return mapped;
}
