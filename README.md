# YouTube search UI (DJ prep pipeline)

Self-hosted workflow to search YouTube, queue audio downloads with **yt-dlp**, run lightweight **BPM/key** analysis, manage a **SQLite-backed library**, and export **Rekordbox-compatible XML**. The stack is a **pnpm monorepo**: Vite + React + Tailwind/DaisyUI (`apps/web`) and Next.js App Router APIs (`apps/api`), with **BullMQ + Redis** for downloads and **Server-Sent Events** for live queue updates.

## Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (see `packageManager` in root `package.json`)
- **Redis** — required for the download queue (BullMQ). From the repo root: **`pnpm redis`** (or `docker-compose up -d redis`; exposes `localhost:6379`).
- **yt-dlp**, **ffmpeg**, and **ffprobe** on your `PATH` for search, download, and analysis hooks (the Docker API image installs these; local dev must install them yourself).
- **Python 3** with analyzer dependencies for real BPM/key/LUFS (Docker installs these from `apps/api/analyzer/requirements.txt`). Local setup:

  ```bash
  pip3 install -r apps/api/analyzer/requirements.txt
  ```

  The API spawns `python3 apps/api/analyzer/analyze.py <file>` (override with `ANALYZER_PYTHON` / `ANALYZER_SCRIPT`). If Python is missing or fails, analysis falls back to a deterministic stub (`analyzerVersion` contains `stub-fallback`).

## Quick start (local development)

1. **Start Redis** (required for API + worker; default `redis://127.0.0.1:6379`). If you use Docker:

   ```bash
   pnpm redis
   ```

   Same as `docker-compose up -d redis`. Without Redis, the worker logs `ECONNREFUSED` on port 6379.

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
| `pnpm redis` | Starts the Compose **redis** service (`docker-compose up -d redis`) for local dev. |
| `pnpm dev` | Runs web + API + worker via `concurrently` (needs Redis). |
| `pnpm dev:web` / `pnpm dev:api` | Single app as above. |
| `pnpm build` | Builds all workspace packages (`apps/web` + `apps/api`, including the bundled `worker.cjs`). |
| `pnpm lint` | Lints all packages. |
| `pnpm docker:build` / `pnpm docker:up` | Build or start the Docker Compose stack (see below). |

## Docker

Compose defines **redis**, **api** (Next standalone + yt-dlp + ffmpeg), **worker** (same image, `node worker.cjs`), and **web** (nginx + static assets, proxies `/api` → api). Data persists in the **`app-data`** volume (`DATA_DIR=/data`).

- **Compose CLI:** `pnpm docker:build` and `pnpm docker:up` run **`docker-compose`** (hyphenated). If your machine only has the plugin form, install the [Compose standalone binary](https://github.com/docker/compose/releases) or alias `docker-compose` to `docker compose`.
- **Published port:** `8080` → web (`http://localhost:8080`).
- Build images: `pnpm docker:build` or `docker-compose build`.
- Run: `pnpm docker:up` or `docker-compose up -d`.
- **`WARN ... buildx plugin`:** Compose may print this when Buildx is not installed. Images often still build; install [Docker Buildx](https://docs.docker.com/build/buildx/installing-buildx/) to remove the warning (optional).

See `docker-compose.yml` and `docker/*.Dockerfile` for details.

### Redis container logs

- **`WARNING Memory overcommit must be enabled`** — Redis wants the **Linux host** sysctl `vm.overcommit_memory=1` so fork-based RDB/AOF is safer under memory pressure. **Docker Desktop (macOS/Windows)** usually cannot set this inside the VM; the message is **common and safe to ignore** for local dev with enough RAM. On **Linux servers**, run `sudo sysctl vm.overcommit_memory=1` (and persist in `/etc/sysctl.conf`) if you run heavy Redis persistence.
- **`Warning: no config file specified`** — The Compose **redis** service uses **`docker/redis/redis.conf`** mounted as `/etc/redis.conf` so Redis starts with an explicit config (appendonly, `maxmemory`, etc.).

## Troubleshooting

- **Docker: API unhealthy (healthcheck fails)** — Next often binds **`localhost` only**; the image sets **`HOSTNAME=0.0.0.0`** so **`curl http://127.0.0.1:3000/api/health`** succeeds. Ensure Compose or the image still passes that env.
- **Docker: worker `Restarting (1)`** — Often **`SQLITE_BUSY`** when API and worker both open **`app.db`** during startup migrations. The API sets **`busy_timeout`** (see `lib/db.ts`) so SQLite waits instead of throwing. The worker also **`depends_on` `api`** with **`service_started`** so startup order is less racy. Rebuild images after pulling.
- **Docker: worker `Cannot find module 'better-sqlite3'`** — Standalone output keeps **`better-sqlite3` under `node_modules/.pnpm/...` only**; **`worker.cjs`** loads it via `require` from `/app`. The API image adds a **symlink** at `/app/node_modules/better-sqlite3` (see `docker/api.Dockerfile`). Rebuild the API/worker image after pulling.
- **Docker: API stuck “Waiting” or exits immediately** — Often **`EACCES` on `/data`**: Compose named volumes are `root`-owned while the app runs as user **`nodejs` (uid 1001)**. The API image entrypoint (`docker/api-entrypoint.sh`) runs **`chown nodejs:nodejs /data`** then starts Node with **`gosu`**. Rebuild the API image after pulling. If you override `entrypoint`, restore this behavior or make `/data` writable by uid 1001.
- **`Error: connect ECONNREFUSED 127.0.0.1:6379` (API / worker)** — Redis is not running. From the repo root run **`pnpm redis`** (or `docker-compose up -d redis`), or point **`REDIS_URL`** at your Redis instance.
- **`Could not locate the bindings file` / `better_sqlite3.node` (worker or API)** — pnpm 10 may skip native install scripts until they are allowlisted. This repo sets `pnpm.onlyBuiltDependencies` in root `package.json` for `better-sqlite3` and `esbuild`. After pulling changes, run `pnpm install` again. If it still fails, run `pnpm rebuild better-sqlite3` from the repo root, or upgrade/downgrade Node and reinstall so the addon matches your ABI (e.g. `node-v137-darwin-arm64`).
- **`msgpackr-extract` install / `ERR_INVALID_ARG_TYPE` / `require(undefined)`** — The optional native addon used by BullMQ’s stack can fail its postinstall under **Node 22 + pnpm**. It is **not** in `onlyBuiltDependencies` so its lifecycle script is skipped; BullMQ/msgpackr use a **JavaScript fallback** (slightly slower, fine for this app). Do not add `msgpackr-extract` to `onlyBuiltDependencies` unless you verify a fixed version.

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
