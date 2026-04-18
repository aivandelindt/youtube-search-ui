import crypto from "node:crypto";

import { Queue } from "bullmq";

import type { DownloadSettings } from "@/lib/download-settings-schema";
import { getBullmqConnection } from "@/lib/bullmq-connection";
import { getDb } from "@/lib/db";
import { getJob, insertJob, updateJob } from "@/lib/jobs-repo";
import { publishCancel, publishJobUpdate } from "@/lib/job-events-publisher";

const QUEUE_NAME = "download";

const RUNNER_KEY = "__youtubeDjDownloadQueue";

function findDuplicatePendingJob(
  videoId: string,
  settings: DownloadSettings,
): string | null {
  const db = getDb();
  const settingsJson = JSON.stringify(settings);
  const row = db
    .prepare(
      `SELECT id FROM jobs WHERE video_id = ? AND settings_json = ? AND status IN ('queued','downloading','converting','analyzing')`,
    )
    .get(videoId, settingsJson) as { id: string } | undefined;
  return row?.id ?? null;
}

type GlobalWithQueue = typeof globalThis & {
  [RUNNER_KEY]?: Queue;
};

export function getDownloadQueue(): Queue {
  const g = globalThis as GlobalWithQueue;
  if (!g[RUNNER_KEY]) {
    g[RUNNER_KEY] = new Queue(QUEUE_NAME, {
      connection: getBullmqConnection(),
    });
  }
  return g[RUNNER_KEY]!;
}

const defaultJobOpts = {
  removeOnComplete: true,
  removeOnFail: false,
  attempts: 1,
} as const;

export async function enqueueNewJob(input: {
  videoId: string;
  title: string;
  channel: string;
  url: string;
  settings: DownloadSettings;
}): Promise<{ jobId: string; deduped: boolean }> {
  const dup = findDuplicatePendingJob(input.videoId, input.settings);
  if (dup) {
    const job = getJob(dup);
    if (job) publishJobUpdate(dup);
    return { jobId: dup, deduped: true };
  }

  const id = crypto.randomUUID();
  insertJob({
    id,
    videoId: input.videoId,
    title: input.title,
    channel: input.channel,
    url: input.url,
    settings: input.settings,
  });
  publishJobUpdate(id);

  await getDownloadQueue().add(
    "run",
    { jobId: id },
    { jobId: id, ...defaultJobOpts },
  );

  return { jobId: id, deduped: false };
}

export async function retryDownloadJob(jobId: string): Promise<boolean> {
  const job = getJob(jobId);
  if (!job || (job.status !== "failed" && job.status !== "cancelled")) {
    return false;
  }
  updateJob(jobId, {
    status: "queued",
    phase: null,
    progress: 0,
    error: null,
    outputPath: null,
    trackId: null,
  });
  publishJobUpdate(jobId);

  const q = getDownloadQueue();
  const existing = await q.getJob(jobId);
  if (existing) {
    await existing.remove();
  }
  await q.add("run", { jobId }, { jobId, ...defaultJobOpts });
  return true;
}

export async function cancelDownloadJob(jobId: string): Promise<boolean> {
  const job = getJob(jobId);
  if (!job) return false;
  if (
    job.status === "done" ||
    job.status === "cancelled" ||
    job.status === "failed"
  ) {
    return false;
  }
  updateJob(jobId, {
    status: "cancelled",
    phase: null,
    progress: 0,
    error: null,
  });
  publishCancel(jobId);

  const q = getDownloadQueue();
  const bj = await q.getJob(jobId);
  if (bj) {
    await bj.remove();
  }
  publishJobUpdate(jobId);
  return true;
}
