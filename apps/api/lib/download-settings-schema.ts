import { z } from "zod";

export const downloadSettingsSchema = z.object({
  format: z.enum(["mp3", "m4a", "wav"]),
  qualityPreset: z.union([
    z.literal(0),
    z.literal(3),
    z.literal(5),
    z.literal(7),
    z.literal(9),
  ]),
  forceCbr: z.boolean(),
  embedThumbnail: z.boolean(),
  embedMetadata: z.boolean(),
  normalize: z.boolean().optional().default(false),
});

export type DownloadSettings = z.infer<typeof downloadSettingsSchema>;

export const createDownloadsBodySchema = z.object({
  items: z
    .array(
      z.object({
        videoId: z.string().min(1),
        title: z.string().min(1),
        channel: z.string().optional().default(""),
        url: z.string().url(),
      }),
    )
    .min(1)
    .max(50),
  settings: downloadSettingsSchema,
});
