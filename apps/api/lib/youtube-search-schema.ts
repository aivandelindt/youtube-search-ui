import { z } from "zod";

export const youtubeSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(500),
  max: z.coerce.number().int().min(1).max(50).default(10),
  duration: z.enum(["any", "short", "medium", "long"]).default("any"),
});

export type YoutubeSearchQuery = z.infer<typeof youtubeSearchQuerySchema>;
