import type { ConnectionOptions } from "bullmq";

/**
 * Connection options for BullMQ Queue / Worker (not a shared ioredis instance).
 */
export function getBullmqConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (url) {
    return { url, maxRetriesPerRequest: null };
  }
  return {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}
