import { Worker } from "bullmq";

import { getBullmqConnection } from "@/lib/bullmq-connection";
import { getDb } from "@/lib/db";
import {
  processDownloadJob,
  startWorkerCancelListener,
} from "@/lib/process-download-job";

getDb();
startWorkerCancelListener();

const connection = getBullmqConnection();

const worker = new Worker("download", processDownloadJob, {
  connection,
  concurrency: 2,
});

worker.on("failed", (job, err) => {
  console.error("[download-worker] job failed", job?.id, err);
});

let loggedRedisHint = false;
worker.on("error", (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    !loggedRedisHint &&
    /ECONNREFUSED|ENOTFOUND/i.test(msg)
  ) {
    loggedRedisHint = true;
    console.error(
      "[download-worker] Redis is not running. From the repo root run: pnpm redis   (or: docker-compose up -d redis). Default URL: redis://127.0.0.1:6379 — set REDIS_URL if Redis is elsewhere.",
    );
  }
  console.error("[download-worker] worker error", err);
});

function shutdown(): void {
  void worker
    .close()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
