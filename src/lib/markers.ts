import { z } from "zod"
import type { Marker } from "@/types/markers"

/**
 * Human-readable place label for a marker, used as image alt text.
 * Landmark stops use the landmark name; city-level stops use the city.
 * The country is appended when known, e.g. "Eiffel Tower, France" or
 * "Paris, France". Falls back to "Location" when nothing is known.
 */
export function getMarkerLocationLabel(marker: Marker): string {
  const place =
    marker.locationType === "landmark" && marker.locationName
      ? marker.locationName
      : marker.city
  return [place, marker.country].filter(Boolean).join(", ") || "Location"
}

export const markerSchema = z.object({
  title: z.string().min(2).max(120),
  creatorName: z.string().min(2).max(120),
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
  timestamp: z.string().regex(/^(\d{1,2}:)?\d{1,2}:\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  locationName: z.string().max(200).optional().or(z.literal("").transform(() => undefined)),
})

export type MarkerPayload = z.infer<typeof markerSchema>

export const locationUpdateSchema = z.object({
  id: z.number().int().positive(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  description: z.string().max(500).optional().nullable().or(z.literal("").transform(() => undefined)),
  city: z.string().max(120).optional().nullable().or(z.literal("").transform(() => undefined)),
  district: z.string().max(120).optional().nullable().or(z.literal("").transform(() => undefined)),
  country: z.string().max(120).optional().nullable().or(z.literal("").transform(() => undefined)),
  screenshotUrl: z.string().url().optional().nullable().or(z.literal("").transform(() => undefined)),
  locationId: z.string().max(36).optional().nullable(),
  locationName: z.string().max(200).optional().nullable().or(z.literal("").transform(() => undefined)),
  timestamp: z.string().regex(/^(\d{1,2}:)?\d{1,2}:\d{2}$/).optional().nullable().or(z.literal("").transform(() => undefined)),
  requestedLocationType: z.enum(['city', 'landmark']).optional(),
})

export const videoMetadataSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  creatorName: z.string().min(2).max(120).optional(),
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
