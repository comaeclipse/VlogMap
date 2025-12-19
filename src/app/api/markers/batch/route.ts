import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { mapMarkerRow, query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { batchUpdateSchema } from "@/lib/markers"
import { assignLocationToMarker } from "@/lib/location-matching"

export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    const body = await request.json()
    const payload = batchUpdateSchema.parse(body)

    // Start transaction
    await query("BEGIN")

    try {
      const updatedMarkers: MarkerRow[] = []

      // Update video metadata if provided
      if (payload.videoMetadata) {
        const metadata = payload.videoMetadata
        const updates: string[] = []
        const values: (string | null)[] = []
        let paramIndex = 1

        // Handle creator update if provided
        let creatorId: number | undefined
        if (metadata.creatorName !== undefined) {
          const { rows: existingCreators } = await query<{ id: number }>(
            `SELECT id FROM creators WHERE name = $1`,
            [metadata.creatorName]
          )
          
          if (existingCreators.length > 0) {
            creatorId = existingCreators[0].id
            // Update channel_url if provided and different
            if (metadata.channelUrl) {
              await query(
                `UPDATE creators SET channel_url = $1 WHERE id = $2`,
                [metadata.channelUrl, creatorId]
              )
            }
          } else {
            // Create new creator
            const { rows: newCreators } = await query<{ id: number }>(
              `INSERT INTO creators (name, channel_url) VALUES ($1, $2) RETURNING id`,
              [metadata.creatorName, metadata.channelUrl ?? null]
            )
            creatorId = newCreators[0].id
          }
          updates.push(`creator_id = $${paramIndex++}`)
          values.push(creatorId)
        }

        if (metadata.title !== undefined) {
          updates.push(`title = $${paramIndex++}`)
          values.push(metadata.title)
        }
        if (metadata.videoPublishedAt !== undefined) {
          updates.push(`video_published_at = $${paramIndex++}`)
          values.push(metadata.videoPublishedAt ?? null)
        }
        if (metadata.summary !== undefined) {
          updates.push(`summary = $${paramIndex++}`)
          values.push(metadata.summary ?? null)
        }

        if (updates.length > 0) {
          values.push(payload.videoUrl)
          await query(
            `UPDATE explorer_markers SET ${updates.join(", ")} WHERE video_url = $${paramIndex}`,
            values
          )
        }
      }

      for (const update of payload.updates) {
        // Verify marker belongs to this video
        const { rows: checkRows } = await query<{ video_url: string }>(
          "SELECT video_url FROM explorer_markers WHERE id = $1",
          [update.id]
        )

        if (checkRows.length === 0) {
          throw new Error(`Marker ${update.id} not found`)
        }

        if (checkRows[0].video_url !== payload.videoUrl) {
          throw new Error(`Marker ${update.id} does not belong to this video`)
        }

        // Update the marker
        await query(
          `UPDATE explorer_markers
           SET latitude = $1, longitude = $2, description = $3, city = $4, screenshot_url = $5, type = $6, parent_city_id = $7, timestamp = $8
           WHERE id = $9`,
          [
            update.latitude,
            update.longitude,
            update.description ?? null,
            update.city ?? null,
            update.screenshotUrl ?? null,
            update.type ?? null,
            update.parentCityId ?? null,
            update.timestamp ?? null,
            update.id,
          ],
        )

        // Fetch updated marker with creator info
        const { rows } = await query<MarkerRow>(
          `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city, m.district, m.country, m.video_published_at, m.screenshot_url, m.summary, m.location_id, m.type, m.parent_city_id, m.timestamp, m.created_at
           FROM explorer_markers m
           JOIN creators c ON m.creator_id = c.id
           WHERE m.id = $1`,
          [update.id],
        )

        updatedMarkers.push(rows[0])

        // Update location name if provided and marker has a locationId
        if (update.locationName !== undefined && update.locationId) {
          await query(
            `UPDATE locations SET name = $1, updated_at = NOW() WHERE id = $2`,
            [update.locationName || null, update.locationId]
          )
        }
      }

      // Reassign location IDs for all updated markers
      for (const marker of updatedMarkers) {
        try {
          await assignLocationToMarker(
            marker.id,
            marker.latitude,
            marker.longitude,
            marker.city,
          )
        } catch (locationError) {
          console.error(
            `Failed to reassign location for marker ${marker.id}:`,
            locationError,
          )
          // Continue with other markers even if one fails
        }
      }

      // Fetch all updated markers with their new location_ids
      const markerIds = updatedMarkers.map((m) => m.id)
      const placeholders = markerIds.map((_, i) => `$${i + 1}`).join(", ")
      const { rows: finalMarkers } = await query<MarkerRow>(
        `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city, m.district, m.country, m.video_published_at, m.screenshot_url, m.summary, m.location_id, m.type, m.parent_city_id, m.timestamp, m.created_at
         FROM explorer_markers m
         JOIN creators c ON m.creator_id = c.id
         WHERE m.id IN (${placeholders})`,
        markerIds,
      )

      await query("COMMIT")

      return NextResponse.json(finalMarkers.map(mapMarkerRow))
    } catch (error) {
      await query("ROLLBACK")
      throw error
    }
  } catch (error) {
    console.error("Failed to batch update markers", error)
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json(
        { error: "Invalid payload", details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update markers" },
      { status: 500 }
    )
  }
}
