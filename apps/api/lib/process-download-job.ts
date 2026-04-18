import type { Job } from "bullmq";

import { analyzeAudioFile } from "@/lib/analyze-track";
import { ffprobeDurationSeconds } from "@/lib/ffprobe";
import { publishJobUpdate } from "@/lib/job-events-publisher";
import {
  getJob,
  type JobStatus,
  updateJob,
  upsertTrackWithAnalysis,
} from "@/lib/jobs-repo";
import { getRedisSubscriber } from "@/lib/redis";
import { getYtdlpArchivePath } from "@/lib/paths";
import { runYtDlpDownload } from "@/lib/ytdlp-download";

const abortControllers = new Map<string, AbortController>();

let cancelListenerStarted = false;

/** Subscribe to Redis cancel channel (call once in the worker process). */
export function startWorkerCancelListener(): void {
  if (cancelListenerStarted) return;
  cancelListenerStarted = true;

  const sub = getRedisSubscriber();
  void sub.subscribe("dj:cancel", (err) => {
    if (err) console.error("[download-worker] cancel subscribe", err);
  });
  sub.on("message", (channel: string, message: string) => {
    if (channel !== "dj:cancel") return;
    try {
      const { jobId } = JSON.parse(message) as { jobId?: string };
      if (!jobId) return;
      abortControllers.get(jobId)?.abort();
    } catch {
      // ignore
    }
  });
}

function patch(
  jobId: string,
  bullJob: Job | null,
  p: {
    status?: JobStatus;
    phase?: string | null;
    progress?: number;
    error?: string | null;
    outputPath?: string | null;
    trackId?: string | null;
  },
): void {
  updateJob(jobId, p);
  const pct = p.progress ?? 0;
  if (bullJob) {
    void bullJob.updateProgress(Math.min(100, Math.max(0, Math.round(pct))));
  }
  publishJobUpdate(jobId);
}

function isCancelled(jobId: string): boolean {
  return getJob(jobId)?.status === "cancelled";
}

export async function processDownloadJob(bullJob: Job): Promise<void> {
  const jobId = bullJob.data.jobId as string;
  if (!jobId) {
    throw new Error("Missing jobId in BullMQ payload");
  }

  const job = getJob(jobId);
  if (!job) return;
  if (job.status === "cancelled") return;

  const controller = new AbortController();
  abortControllers.set(jobId, controller);

  try {
    patch(jobId, bullJob, { status: "downloading", phase: "yt-dlp", progress: 1 });

    const archivePath = getYtdlpArchivePath();

    const result = await runYtDlpDownload({
      url: job.url,
      videoId: job.videoId,
      settings: job.settings,
      archivePath,
      abortSignal: controller.signal,
      onProgress: (prog) => {
        if (isCancelled(jobId)) {
          controller.abort();
          return;
        }
        const pct = prog.percent ?? 0;
        patch(jobId, bullJob, {
          status: "downloading",
          phase: "yt-dlp",
          progress: Math.min(95, Math.max(1, pct)),
        });
      },
    });

    if (isCancelled(jobId)) {
      controller.abort();
      return;
    }

    patch(jobId, bullJob, {
      status: "converting",
      phase: "post",
      progress: 96,
      outputPath: result.outputPath,
    });

    patch(jobId, bullJob, { status: "analyzing", phase: "analysis", progress: 97 });

    const durationSec = await ffprobeDurationSeconds(result.outputPath);
    const analysis = await analyzeAudioFile(result.outputPath);

    const current = getJob(jobId);
    if (!current || isCancelled(jobId)) return;

    upsertTrackWithAnalysis({
      jobId,
      videoId: current.videoId,
      title: current.title,
      channel: current.channel,
      filePath: result.outputPath,
      format: current.settings.format,
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
    patch(jobId, bullJob, {
      status: "done",
      phase: null,
      progress: 100,
      outputPath: result.outputPath,
      trackId: doneJob?.trackId ?? null,
    });
  } catch (err) {
    if (controller.signal.aborted || isCancelled(jobId)) {
      const j = getJob(jobId);
      if (j && j.status !== "cancelled") {
        updateJob(jobId, {
          status: "cancelled",
          phase: null,
          progress: 0,
          error: null,
        });
        publishJobUpdate(jobId);
      }
      return;
    }
    const message = err instanceof Error ? err.message : "Job failed";
    patch(jobId, bullJob, {
      status: "failed",
      phase: null,
      progress: 0,
      error: message,
    });
  } finally {
    abortControllers.delete(jobId);
  }
}
