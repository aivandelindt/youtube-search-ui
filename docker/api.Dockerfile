# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:22.12-bookworm-slim
ARG YTDLP_VERSION=2024.12.13

FROM ${NODE_IMAGE} AS deps
RUN npm install -g pnpm@10.33.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api...

FROM deps AS builder
COPY apps/api apps/api
WORKDIR /repo/apps/api
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

FROM ${NODE_IMAGE} AS runner
ARG YTDLP_VERSION

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    python3 \
    python3-venv \
  && python3 -m venv /opt/ytdlp-venv \
  && /opt/ytdlp-venv/bin/pip install --no-cache-dir "yt-dlp==${YTDLP_VERSION}" \
  && ln -sf /opt/ytdlp-venv/bin/yt-dlp /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --home /app --shell /usr/sbin/nologin nodejs

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=nodejs:nodejs /repo/apps/api/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /repo/apps/api/.next/static ./apps/api/.next/static
COPY --from=builder --chown=nodejs:nodejs /repo/apps/api/public ./apps/api/public
COPY --from=builder --chown=nodejs:nodejs /repo/apps/api/.next/worker.cjs ./worker.cjs

USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

CMD ["node", "apps/api/server.js"]
