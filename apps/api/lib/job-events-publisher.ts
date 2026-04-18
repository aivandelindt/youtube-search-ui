import { getRedis } from "@/lib/redis";

const CHANNEL = "dj:job-updates";
const CANCEL_CHANNEL = "dj:cancel";

export function publishJobUpdate(jobId: string): void {
  void getRedis().publish(
    CHANNEL,
    JSON.stringify({ jobId }),
  );
}

export function publishCancel(jobId: string): void {
  void getRedis().publish(
    CANCEL_CHANNEL,
    JSON.stringify({ jobId }),
  );
}
