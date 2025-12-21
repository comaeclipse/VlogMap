import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { mapMarkerRow, query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { batchUpdateSchema } from "@/lib/markers"
import { assignLocationToMarker, switchMarkerLocationType } from "@/lib/location-matching"

const MARKER_SELECT = `
  SELECT 
    m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, 
    m.video_url, m.description, 
    m.latitude, m.longitude, m.city, m.district, m.country, 
    m.video_published_at, m.screenshot_url, m.summary, m.location_id, 
    m.timestamp, m.created_at,
    l.name as location_name,
    l.type as location_type,
    l.parent_location_id as parent_location_id,
    pc.name as parent_location_name
  FROM explorer_markers m
  JOIN creators c ON m.creator_id = c.id
  LEFT JOIN locations l ON m.location_id = l.id
  LEFT JOIN locations pc ON l.parent_location_id = pc.id
`

export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    const body = await request.json()
    const payload = batchUpdateSchema.parse(body)

    // Start transaction
    await query("BEGIN")

    try {
      const updatedMarkerIds: number[] = []

      // Update video metadata if provided
      if (payload.videoMetadata) {
        const metadata = payload.videoMetadata
        const updates: string[] = []
        const values: (string | number | null)[] = []
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
        const { rows: checkRows } = await query<{ video_url: string; latitude: number; longitude: number; location_id: string | null; city: string | null; district: string | null; country: string | null }>(
          "SELECT video_url, latitude, longitude, location_id, city, district, country FROM explorer_markers WHERE id = $1",
          [update.id]
        )

        if (checkRows.length === 0) {
          throw new Error(`Marker ${update.id} not found`)
        }

        if (checkRows[0].video_url !== payload.videoUrl) {
          throw new Error(`Marker ${update.id} does not belong to this video`)
        }

        // Handle location type change FIRST (before coordinate updates)
        if (update.requestedLocationType && checkRows[0].location_id) {
          try {
            // Get current location type
            const { rows: locationRows } = await query<{ type: string }>(
              'SELECT type FROM locations WHERE id = $1',
              [checkRows[0].location_id]
            )

            if (locationRows.length > 0 && locationRows[0].type !== update.requestedLocationType) {
              await switchMarkerLocationType(
                update.id,
                checkRows[0].location_id,
                update.requestedLocationType,
                update.latitude,
                update.longitude,
                update.city ?? checkRows[0].city ?? '',
                update.city ? null : checkRows[0].district,
                update.city ? null : checkRows[0].country,
              )
            }
          } catch (locationTypeError) {
            console.error(
              `Failed to switch location type for marker ${update.id}:`,
              locationTypeError,
            )
            // Don't throw - continue with other updates
          }
        }

        // Update the marker (no type or parent_city_id)
        await query(
          `UPDATE explorer_markers
           SET latitude = $1, longitude = $2, description = $3, city = $4, screenshot_url = $5, timestamp = $6
           WHERE id = $7`,
          [
            update.latitude,
            update.longitude,
            update.description ?? null,
            update.city ?? null,
            update.screenshotUrl ?? null,
            update.timestamp ?? null,
            update.id,
          ],
        )

        updatedMarkerIds.push(update.id)

        // Check if coordinates changed significantly (skip if location type was just changed)
        const coordinatesChanged =
          !update.requestedLocationType && (
            Math.abs(checkRows[0].latitude - update.latitude) > 0.002 ||
            Math.abs(checkRows[0].longitude - update.longitude) > 0.002
          )

        // Reassign location if coordinates changed (but not if type was changed)
        if (coordinatesChanged) {
          try {
            await assignLocationToMarker(
              update.id,
              update.latitude,
              update.longitude,
              update.city ?? null,
            )
          } catch (locationError) {
            console.error(
              `Failed to reassign location for marker ${update.id}:`,
              locationError,
            )
          }
        }

        // Update location name if provided
        if (update.locationName !== undefined) {
          const { rows: markerRows } = await query<{ location_id: string | null }>(
            `SELECT location_id FROM explorer_markers WHERE id = $1`,
            [update.id]
          )
          if (markerRows[0]?.location_id) {
            await query(
              `UPDATE locations SET name = $1, updated_at = NOW() WHERE id = $2`,
              [update.locationName || null, markerRows[0].location_id]
            )
          }
        }
      }

      // Fetch all updated markers with their location data
      const placeholders = updatedMarkerIds.map((_, i) => `$${i + 1}`).join(", ")
      const { rows: finalMarkers } = await query<MarkerRow>(
        `${MARKER_SELECT} WHERE m.id IN (${placeholders})`,
        updatedMarkerIds,
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
