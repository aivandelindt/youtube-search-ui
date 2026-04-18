import { getRedisSubscriber } from "@/lib/redis";

import { getJob, listJobs } from "@/lib/jobs-repo";
import { broadcastSse } from "@/lib/sse-broadcast";

const JOB_CHANNEL = "dj:job-updates";

let started = false;

export function startJobEventsSubscriber(): void {
  if (started) return;
  if (process.env.NEXT_RUNTIME === "edge") return;
  started = true;

  const sub = getRedisSubscriber();

  void sub.subscribe(JOB_CHANNEL, (err) => {
    if (err) {
      console.error("[job-events-subscriber] subscribe failed", err);
    }
  });

  sub.on("message", (_channel, message) => {
    try {
      const data = JSON.parse(message) as { jobId?: string };
      if (!data.jobId) return;
      const job = getJob(data.jobId);
      if (job) {
        broadcastSse("job", job);
        if (job.status === "done") {
          broadcastSse("library", { ok: true });
        }
      }
      broadcastSse("jobs", { jobs: listJobs(500) });
    } catch (e) {
      console.error("[job-events-subscriber] message", e);
    }
  });
}
