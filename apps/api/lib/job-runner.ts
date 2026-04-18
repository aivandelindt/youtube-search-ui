import crypto from "node:crypto";

import PQueue from "p-queue";

import { analyzeAudioFile } from "@/lib/analyze-track";
import type { DownloadSettings } from "@/lib/download-settings-schema";
import {
  getJob,
  insertJob,
  listJobs,
  type JobRow,
  type JobStatus,
  updateJob,
  upsertTrackWithAnalysis,
} from "@/lib/jobs-repo";
import { getDb } from "@/lib/db";
import { getYtdlpArchivePath } from "@/lib/paths";
import { broadcastSse } from "@/lib/sse-broadcast";
import { runYtDlpDownload } from "@/lib/ytdlp-download";
import { ffprobeDurationSeconds } from "@/lib/ffprobe";

const RUNNER_KEY = "__youtubeDjJobRunner";

function emitJobs(): void {
  broadcastSse("jobs", { jobs: listJobs(500) });
}

function emitJob(job: JobRow): void {
  broadcastSse("job", job);
}

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

export class JobRunner {
  private readonly queue = new PQueue({ concurrency: 2 });
  private readonly abortControllers = new Map<string, AbortController>();

  enqueueNewJob(input: {
    videoId: string;
    title: string;
    channel: string;
    url: string;
    settings: DownloadSettings;
  }): { jobId: string; deduped: boolean } {
    const dup = findDuplicatePendingJob(input.videoId, input.settings);
    if (dup) {
      const job = getJob(dup);
      if (job) emitJob(job);
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
    const job = getJob(id);
    if (job) emitJob(job);
    emitJobs();

    void this.queue.add(() => this.runJob(id));
    return { jobId: id, deduped: false };
  }

  retry(jobId: string): boolean {
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
    const updated = getJob(jobId);
    if (updated) emitJob(updated);
    emitJobs();
    void this.queue.add(() => this.runJob(jobId));
    return true;
  }

  cancel(jobId: string): boolean {
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
    this.abortControllers.get(jobId)?.abort();
    const updated = getJob(jobId);
    if (updated) emitJob(updated);
    emitJobs();
    return true;
  }

  private async runJob(jobId: string): Promise<void> {
    const job = getJob(jobId);
    if (!job) return;
    if (job.status === "cancelled") return;

    const controller = new AbortController();
    this.abortControllers.set(jobId, controller);

    const patch = (p: {
      status?: JobStatus;
      phase?: string | null;
      progress?: number;
      error?: string | null;
      outputPath?: string | null;
      trackId?: string | null;
    }) => {
      updateJob(jobId, p);
      const j = getJob(jobId);
      if (j) emitJob(j);
      emitJobs();
    };

    try {
      patch({ status: "downloading", phase: "yt-dlp", progress: 1 });

      const archivePath = getYtdlpArchivePath();
      const result = await runYtDlpDownload({
        url: job.url,
        videoId: job.videoId,
        settings: job.settings,
        archivePath,
        abortSignal: controller.signal,
        onProgress: (prog) => {
          const pct = prog.percent ?? 0;
          patch({
            status: "downloading",
            phase: "yt-dlp",
            progress: Math.min(95, Math.max(1, pct)),
          });
        },
      });

      patch({
        status: "converting",
        phase: "post",
        progress: 96,
        outputPath: result.outputPath,
      });

      patch({ status: "analyzing", phase: "analysis", progress: 97 });

      const durationSec = await ffprobeDurationSeconds(result.outputPath);
      const analysis = await analyzeAudioFile(result.outputPath);

      upsertTrackWithAnalysis({
        jobId,
        videoId: job.videoId,
        title: job.title,
        channel: job.channel,
        filePath: result.outputPath,
        format: job.settings.format,
        durationSec,
        analysis: {
          bpm: analysis.bpm,
          bpmConfidence: analysis.bpmConfidence,
          keyMusical: analysis.keyMusical,
          keyCamelot: analysis.keyCamelot,
          energy: analysis.energy,
          integratedLufs: analysis.integratedLufs,
          beatsJson: analysis.beatsJson,
          analyzerVersion: analysis.analyzerVersion,
        },
      });

      const doneJob = getJob(jobId);
      patch({
        status: "done",
        phase: null,
        progress: 100,
        outputPath: result.outputPath,
        trackId: doneJob?.trackId ?? null,
      });
      broadcastSse("library", { ok: true });
    } catch (err) {
      if (controller.signal.aborted) {
        const j = getJob(jobId);
        if (j && j.status !== "cancelled") {
          updateJob(jobId, {
            status: "cancelled",
            phase: null,
            progress: 0,
            error: null,
          });
          const u = getJob(jobId);
          if (u) emitJob(u);
          emitJobs();
        }
        return;
      }
      const message = err instanceof Error ? err.message : "Job failed";
      patch({
        status: "failed",
        phase: null,
        progress: 0,
        error: message,
      });
    } finally {
      this.abortControllers.delete(jobId);
    }
  }
}

type GlobalWithRunner = typeof globalThis & {
  [RUNNER_KEY]?: JobRunner;
};

export function getJobRunner(): JobRunner {
  const g = globalThis as GlobalWithRunner;
  if (!g[RUNNER_KEY]) {
    g[RUNNER_KEY] = new JobRunner();
  }
  return g[RUNNER_KEY]!;
}
