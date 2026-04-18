# Skill: YouTube DJ prep pipeline

**Role:** Build a self-hosted web app to search YouTube, download audio with `yt-dlp`, analyze BPM/key, and export files compatible with Rekordbox and Pioneer CDJ-2000NXS2.

## Stack (target)


| Layer    | Choice                                                                  |
| -------- | ----------------------------------------------------------------------- |
| Frontend | Vite + React + Tailwind CSS + DaisyUI                                   |
| Backend  | Next.js App Router (`app/api/**/route.ts`), Node 20+                    |
| Binaries | `yt-dlp`, `ffmpeg`, `ffprobe` on `PATH`                                 |
| Analysis | Python sidecar (librosa / essentia) preferred for accuracy              |
| Queue    | BullMQ + Redis in production; in-memory / `p-queue` in dev              |
| Storage  | SQLite (`better-sqlite3` or Prisma) + structured library folder on disk |


## Non-functional goals

- Idempotent downloads (archive file + hash where possible).
- Long work off the HTTP request thread (queue workers).
- Live status via WebSocket or SSE (`/api/queue/stream` planned).
- Zod validation on API inputs.

## Current vertical slices

1. **Done:** Monorepo scaffold (`apps/web`, `apps/api`).
2. **Done:** YouTube search — UI + `GET /api/youtube/search` via `yt-dlp` (`ytsearchN:` + `--dump-json --flat-playlist`).
3. **Done:** Download queue (`POST /api/downloads`, in-process `p-queue`, `yt-dlp` + archive), **SSE** (`GET /api/queue/stream`), **SQLite** (`better-sqlite3`, `DATA_DIR`/`data/app.db`), **stub analysis** (`lib/analyze-track.ts` — replace with Python later), **library** (`GET /api/library`, tracks CRUD, preview `/api/tracks/:id/file`), **Rekordbox XML** (`POST /api/export/rekordbox`).

## yt-dlp search (this repo)

- Query params: `q`, `max` (1–50), `duration` (`any`  `short`  `medium`  `long`).
- Implementation: `yt-dlp --dump-json --flat-playlist "ytsearch{max}:{q}"`, NDJSON stdout, normalized to `{ results: [...] }`.
- Dev: Vite proxies `/api` → Next (`http://localhost:3000`).

## Download / audio (planned)

- Formats: MP3 / M4A / WAV; quality presets map to `--audio-quality` or fixed Kbps for CBR.
- “Best” MP3: prefer `-f bestaudio/best` before extract; CBR for CDJs often `320K` MP3.
- Embed: `--embed-thumbnail`, `--embed-metadata`; archive for skip-if-exists.

## Rekordbox / CDJ notes

- Prefer **MP3 320 CBR** or **AAC/M4A ~256k** for players; ID3v2.3 + UTF-16 for MP3; artwork ≤ 800×800 JPEG for CDJ-2000NXS2 displays.
- Rekordbox XML: `DJ_PLAYLISTS` v1.0.0; `Location` as proper `file://` URLs.

## Commands

```bash
pnpm dev          # web + api (Vite proxies /api → Next on :3000)
pnpm dev:web      # Vite only — `/api/youtube/search` calls need the API or a proxy
pnpm dev:api      # Next.js API only
```

Production builds: configure an absolute API base URL for the web app if the UI and API are on different origins (the dev proxy is Vite-only).

## Docker

- `docker compose` builds **`youtube-search-ui-web`** (nginx + static Vite `dist`, proxies `/api` → `api`) and **`youtube-search-ui-api`** (Next.js `standalone`, non-root `nodejs` user, `yt-dlp` + `ffmpeg` in image).
- Published port: **8080 → web:80** (browser uses same-origin `/api/...` through nginx).
- Root scripts: `pnpm docker:build`, `pnpm docker:up` (use `docker compose` instead if your CLI uses the plugin). See `docker-compose.yml` and `docker/*.Dockerfile`.

## Prerequisites

- Node 20+
- `pnpm`
- `yt-dlp` installed and on `PATH` (search API)

