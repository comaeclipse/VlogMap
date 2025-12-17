import { z } from "zod"

export const markerSchema = z.object({
  title: z.string().min(2).max(120),
  creator: z.string().min(2).max(120),
  channelUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  videoUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  description: z.string().max(500).optional().or(z.literal("").transform(() => undefined)),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  city: z.string().max(120).optional().or(z.literal("").transform(() => undefined)),
  district: z.string().max(120).optional().or(z.literal("").transform(() => undefined)),
  country: z.string().max(120).optional().or(z.literal("").transform(() => undefined)),
  videoPublishedAt: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  screenshotUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  summary: z.string().max(10000).optional().or(z.literal("").transform(() => undefined)),
})

export type MarkerPayload = z.infer<typeof markerSchema>

export const locationUpdateSchema = z.object({
  id: z.number().int().positive(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  description: z.string().max(500).optional().nullable().or(z.literal("").transform(() => undefined)),
  city: z.string().max(120).optional().nullable().or(z.literal("").transform(() => undefined)),
  screenshotUrl: z.string().url().optional().nullable().or(z.literal("").transform(() => undefined)),
  locationId: z.string().max(8).optional().nullable(),
  locationName: z.string().max(200).optional().nullable().or(z.literal("").transform(() => undefined)),
})

export const videoMetadataSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  creator: z.string().min(2).max(120).optional(),
  channelUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  videoPublishedAt: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  summary: z.string().max(10000).optional().or(z.literal("").transform(() => undefined)),
})

export const batchUpdateSchema = z.object({
  videoUrl: z.string().url().min(1),
  updates: z.array(locationUpdateSchema).min(1),
  videoMetadata: videoMetadataSchema.optional(),
})

export type LocationUpdatePayload = z.infer<typeof locationUpdateSchema>
export type VideoMetadataPayload = z.infer<typeof videoMetadataSchema>
export type BatchUpdatePayload = z.infer<typeof batchUpdateSchema>
