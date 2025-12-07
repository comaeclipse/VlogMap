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
  videoPublishedAt: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
})

export type MarkerPayload = z.infer<typeof markerSchema>

export const locationUpdateSchema = z.object({
  id: z.number().int().positive(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  description: z.string().max(500).optional().or(z.literal("").transform(() => undefined)),
  city: z.string().max(120).optional().or(z.literal("").transform(() => undefined)),
})

export const batchUpdateSchema = z.object({
  videoUrl: z.string().url().min(1),
  updates: z.array(locationUpdateSchema).min(1),
})

export type LocationUpdatePayload = z.infer<typeof locationUpdateSchema>
export type BatchUpdatePayload = z.infer<typeof batchUpdateSchema>
