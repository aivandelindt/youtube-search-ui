# YouTube search UI (DJ prep pipeline)

Self-hosted workflow to search YouTube, queue audio downloads with **yt-dlp**, run lightweight **BPM/key** analysis, manage a **SQLite-backed library**, and export **Rekordbox-compatible XML**. The stack is a **pnpm monorepo**: Vite + React + Tailwind/DaisyUI (`apps/web`) and Next.js App Router APIs (`apps/api`), with **BullMQ + Redis** for downloads and **Server-Sent Events** for live queue updates.

## Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (see `packageManager` in root `package.json`)
- **Redis** — required for the download queue (BullMQ). Easiest: `docker-compose up -d redis` from this repo (exposes `localhost:6379`).
- **yt-dlp**, **ffmpeg**, and **ffprobe** on your `PATH` for search, download, and analysis hooks (the Docker API image installs these; local dev must install them yourself).
- **Python 3** with analyzer dependencies for real BPM/key/LUFS (Docker installs these from `apps/api/analyzer/requirements.txt`). Local setup:

  ```bash
  pip3 install -r apps/api/analyzer/requirements.txt
  ```

  The API spawns `python3 apps/api/analyzer/analyze.py <file>` (override with `ANALYZER_PYTHON` / `ANALYZER_SCRIPT`). If Python is missing or fails, analysis falls back to a deterministic stub (`analyzerVersion` contains `stub-fallback`).

## Quick start (local development)

1. **Start Redis** (if nothing is listening on port 6379):

   ```bash
   docker-compose up -d redis
   ```

2. **Install dependencies** (from the repo root):

   ```bash
   pnpm install
   ```

3. **Run the app** — web UI, Next.js API, and the BullMQ worker:

   ```bash
   pnpm dev
   ```

   - **Web (Vite):** dev server with `/api` proxied to the API (see `apps/web/vite.config.ts`).
   - **API (Next.js):** `http://localhost:3000` by default.
   - **Worker:** processes jobs from the `download` queue; keep it running whenever you enqueue downloads.

   Narrower commands:

   ```bash
   pnpm dev:web          # frontend only (API calls need a running API or proxy)
   pnpm dev:api          # Next.js API only
   pnpm --filter api worker   # worker only
   ```

4. Open the Vite dev URL printed in the terminal (typically **`http://localhost:5173`**) so browser calls hit `/api/...` and the proxy forwards to Next.

### Environment variables (API / worker)

| Variable | Purpose |
| -------- | ------- |
| `REDIS_URL` | Redis connection string. Default if unset: `redis://127.0.0.1:6379` (`apps/api/lib/redis.ts`). |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Alternative to `REDIS_URL` for BullMQ (`apps/api/lib/bullmq-connection.ts`). |
| `DATA_DIR` | Root directory for SQLite (`app.db`), library audio, and the yt-dlp download archive. Default: `./data` under the API working directory. |
| `PORT` | Next.js listen port (default 3000). |
| `ANALYZER_PYTHON` | Python executable (default `python3`). |
| `ANALYZER_SCRIPT` | Absolute path to `analyze.py` if auto-detection fails. |
| `ANALYZER_TIMEOUT_MS` | Analyzer subprocess timeout (default `120000`). |
| `ANALYZER_DISABLE` | Set to `1` to force stub analysis (testing). |

Production or split deployments should set the same `DATA_DIR` (shared volume) for **api** and **worker** so the queue and SQLite stay consistent.

## Scripts (root)

| Script | Description |
| ------ | ----------- |
| `pnpm dev` | Runs web + API + worker via `concurrently` (needs Redis). |
| `pnpm dev:web` / `pnpm dev:api` | Single app as above. |
| `pnpm build` | Builds all workspace packages (`apps/web` + `apps/api`, including the bundled `worker.cjs`). |
| `pnpm lint` | Lints all packages. |
| `pnpm docker:build` / `pnpm docker:up` | Build or start the Docker Compose stack (see below). |

## Docker

Compose defines **redis**, **api** (Next standalone + yt-dlp + ffmpeg), **worker** (same image, `node worker.cjs`), and **web** (nginx + static assets, proxies `/api` → api). Data persists in the **`app-data`** volume (`DATA_DIR=/data`).

- **Published port:** `8080` → web (`http://localhost:8080`).
- Build images: `pnpm docker:build` or `docker-compose build`.
- Run: `pnpm docker:up` or `docker-compose up -d`.

See `docker-compose.yml` and `docker/*.Dockerfile` for details.

## Troubleshooting

- **`Error: connect ECONNREFUSED 127.0.0.1:6379` (API / worker)** — Redis is not running. Start it, e.g. `docker-compose up -d redis`, or point `REDIS_URL` at your instance.
- **`Could not locate the bindings file` / `better_sqlite3.node` (worker or API)** — pnpm 10 may skip native install scripts until they are allowlisted. This repo sets `pnpm.onlyBuiltDependencies` in root `package.json` for `better-sqlite3` (and related build-only deps). After pulling changes, run `pnpm install` again. If it still fails, run `pnpm rebuild better-sqlite3` from the repo root, or upgrade/downgrade Node and reinstall so the addon matches your ABI (e.g. `node-v137-darwin-arm64`).

## Repository layout

- `apps/web` — Vite + React UI (queue panel, library, search).
- `apps/api` — Next.js routes under `app/api/**`, shared libs under `lib/`, BullMQ worker entry under `workers/`, Redis pub/sub for SSE in `instrumentation.ts`.
- `SKILL.md` — Product and technical context (stack, slices, Rekordbox/CDJ notes).

---

## Remaining work and open points

These items are **not** fully implemented or are intentionally left for later. Use them as a backlog aligned with `SKILL.md`.

### 1. Stronger download idempotency

The yt-dlp **download archive** file is used to skip already-seen IDs. Further hardening (per `SKILL.md`) could include **content hashing**, clearer conflict handling when files already exist, and surfacing archive/skip decisions in the UI.

### 2. SSE vs WebSockets

Live queue status uses **SSE** (`GET /api/queue/stream`) with Redis pub/sub on the API process. A **WebSocket** path is still optional if you need bidirectional messages or different scaling characteristics; not required for the current feature set.

### 3. Production: split origins for web and API

In development, Vite proxies `/api` to Next. If you deploy the static site and API on **different origins**, you must configure the frontend base URL (or reverse proxy) so API calls resolve correctly; same-origin `/api` through nginx (as in Compose) avoids extra CORS setup.

### 4. Download and encode policy (documentation vs enforcement)

`SKILL.md` lists practical defaults (e.g. MP3 320 CBR for CDJs, embed thumbnails/metadata). The UI and `yt-dlp` flags should stay aligned with those notes; tightening validation and presets is ongoing product work.

### 5. Persistence and ops

- **SQLite + `better-sqlite3`** is embedded; migrating to **Prisma** (or another layer) is optional and not started.
- **Backups:** plan snapshots of `DATA_DIR` (DB + audio + archive file) for production.
- **Redis:** required at runtime; monitor memory and persistence settings if you move beyond a single-node setup.

### 6. Tests and CI

Automated **e2e or integration tests** (Playwright, queue + API smoke) are not wired in this repo yet; add them before treating releases as safe without manual checks.

---

For deeper conventions (yt-dlp search behavior, Rekordbox XML shape, Zod validation), see **`SKILL.md`**.
