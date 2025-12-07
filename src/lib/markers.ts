import { z } from "zod"

export const markerSchema = z.object({
  title: z.string().min(2).max(120),
  creator: z.string().min(2).max(120),
  channelUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  videoUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  description: z.string().max(500).optional().or(z.literal("").transform(() => undefined)),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  videoPublishedAt: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
})

export type MarkerPayload = z.infer<typeof markerSchema>
