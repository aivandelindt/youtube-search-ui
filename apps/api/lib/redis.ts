import Redis from "ioredis";

export type RedisConnection = string | Redis;

const opts = {
  maxRetriesPerRequest: null,
} as const;

let shared: Redis | null = null;

/**
 * Shared ioredis client for pub/sub and ad-hoc commands.
 * BullMQ Queue/Worker use their own connections from the same URL/options.
 */
export function getRedis(): Redis {
  if (!shared) {
    shared = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      ...opts,
    });
  }
  return shared;
}

/** Duplicate connection for SUBSCRIBE (ioredis requirement). */
export function getRedisSubscriber(): Redis {
  return getRedis().duplicate();
}
