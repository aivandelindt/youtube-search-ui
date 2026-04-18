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

worker.on("error", (err) => {
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
