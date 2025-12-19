import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { mapMarkerRow, query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { markerSchema } from "@/lib/markers"
import {
  assignLocationToMarker,
  updateLocationCentroid,
} from "@/lib/location-matching"

function parseId(id: string) {
  const numeric = Number(id)
  if (Number.isNaN(numeric) || numeric < 1) {
    return null
  }
  return numeric
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  const { id: rawId } = await context.params
  const id = parseId(rawId)
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const payload = markerSchema.parse(body)

    // Get old location_id, coordinates, and type before update
    const { rows: oldRows } = await query<{
      location_id: string | null
      latitude: number
      longitude: number
      type: string | null
    }>(
      "SELECT location_id, latitude, longitude, type FROM explorer_markers WHERE id = $1",
      [id],
    )

    if (!oldRows.length) {
      return NextResponse.json({ error: "Marker not found" }, { status: 404 })
    }

    const oldLocationId = oldRows[0].location_id
    const oldLatitude = oldRows[0].latitude
    const oldLongitude = oldRows[0].longitude
    const oldType = oldRows[0].type

    // Validate parent_city_id if provided
    if (payload.parentCityId) {
      // Prevent self-reference
      if (payload.parentCityId === id) {
        return NextResponse.json(
          { error: "A marker cannot be its own parent" },
          { status: 400 }
        )
      }

      const { rows: parentRows } = await query<{ type: string | null }>(
        `SELECT type FROM explorer_markers WHERE id = $1`,
        [payload.parentCityId]
      )
      
      if (parentRows.length === 0) {
        return NextResponse.json(
          { error: "Parent city marker not found" },
          { status: 400 }
        )
      }
      
      if (parentRows[0].type !== 'city') {
        return NextResponse.json(
          { error: "Parent marker must be of type 'city'" },
          { status: 400 }
        )
      }
    }

    // If type is changing from 'city' to something else, orphan child landmarks
    if (oldType === 'city' && payload.type !== 'city') {
      await query(
        `UPDATE explorer_markers SET parent_city_id = NULL WHERE parent_city_id = $1`,
        [id]
      )
    }

    // Look up or create creator
    let creatorId: number
    const { rows: existingCreators } = await query<{ id: number }>(
      `SELECT id FROM creators WHERE name = $1`,
      [payload.creatorName]
    )
    
    if (existingCreators.length > 0) {
      creatorId = existingCreators[0].id
      // Update channel_url if provided and different
      if (payload.channelUrl) {
        await query(
          `UPDATE creators SET channel_url = $1 WHERE id = $2`,
          [payload.channelUrl, creatorId]
        )
      }
    } else {
      // Create new creator
      const { rows: newCreators } = await query<{ id: number }>(
        `INSERT INTO creators (name, channel_url) VALUES ($1, $2) RETURNING id`,
        [payload.creatorName, payload.channelUrl ?? null]
      )
      creatorId = newCreators[0].id
    }

    // Check if coordinates changed significantly (more than 200m ~ 0.002 degrees)
    const coordinatesChanged =
      Math.abs(oldLatitude - payload.latitude) > 0.002 ||
      Math.abs(oldLongitude - payload.longitude) > 0.002

    // Update marker
    await query(
      `
        UPDATE explorer_markers
        SET title = $1,
            creator_id = $2,
            video_url = $3,
            description = $4,
            latitude = $5,
            longitude = $6,
            city = $7,
            district = $8,
            country = $9,
            video_published_at = $10,
            screenshot_url = $11,
            summary = $12,
            type = $13,
            parent_city_id = $14,
            timestamp = $15
        WHERE id = $16
      `,
      [
        payload.title,
        creatorId,
        payload.videoUrl ?? null,
        payload.description ?? null,
        payload.latitude,
        payload.longitude,
        payload.city ?? null,
        payload.district ?? null,
        payload.country ?? null,
        payload.videoPublishedAt
          ? new Date(payload.videoPublishedAt).toISOString()
          : null,
        payload.screenshotUrl ?? null,
        payload.summary ?? null,
        payload.type ?? null,
        payload.parentCityId ?? null,
        payload.timestamp ?? null,
        id,
      ],
    )

    // Fetch updated marker with creator info
    const { rows } = await query<MarkerRow>(
      `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city, m.district, m.country, m.video_published_at, m.screenshot_url, m.summary, m.location_id, m.type, m.parent_city_id, m.timestamp, m.created_at
       FROM explorer_markers m
       JOIN creators c ON m.creator_id = c.id
       WHERE m.id = $1`,
      [id],
    )

    // Handle location reassignment if coordinates changed
    if (coordinatesChanged) {
      try {
        // Assign new location (or find nearby existing one)
        await assignLocationToMarker(
          id,
          payload.latitude,
          payload.longitude,
          payload.city ?? null,
          payload.district ?? null,
          payload.country ?? null,
        )

        // Update centroid of old location (if it exists)
        if (oldLocationId) {
          await updateLocationCentroid(oldLocationId)
        }

        // Fetch updated marker with new location_id
        const { rows: updatedRows } = await query<MarkerRow>(
          `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city, m.district, m.country, m.video_published_at, m.screenshot_url, m.summary, m.location_id, m.type, m.parent_city_id, m.timestamp, m.created_at
           FROM explorer_markers m
           JOIN creators c ON m.creator_id = c.id
           WHERE m.id = $1`,
          [id],
        )

        return NextResponse.json(mapMarkerRow(updatedRows[0]))
      } catch (locationError) {
        console.error("Failed to reassign location ID:", locationError)
        // Return marker with old location_id if reassignment fails
      }
    } else if (oldLocationId) {
      // Coordinates didn't change much, just update centroid of current location
      try {
        await updateLocationCentroid(oldLocationId)
      } catch (centroidError) {
        console.error("Failed to update centroid:", centroidError)
      }
    }

    return NextResponse.json(mapMarkerRow(rows[0]))
  } catch (error) {
    console.error("Failed to update marker", error)
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json(
        { error: "Invalid payload", details: error },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: "Unable to update marker" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  const { id: rawId } = await context.params
  const id = parseId(rawId)
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    // Get location_id before deletion
    const { rows: markerRows } = await query<{ location_id: string | null }>(
      "SELECT location_id FROM explorer_markers WHERE id = $1",
      [id],
    )

    const locationId = markerRows[0]?.location_id

    // Delete marker
    const { rowCount } = await query(
      `DELETE FROM explorer_markers WHERE id = $1`,
      [id],
    )

    if (!rowCount) {
      return NextResponse.json({ error: "Marker not found" }, { status: 404 })
    }

    // Update centroid of location (will auto-delete if no markers remain)
    if (locationId) {
      try {
        await updateLocationCentroid(locationId)
      } catch (locationError) {
        console.error(
          "Failed to update location centroid after deletion:",
          locationError,
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete marker", error)
    return NextResponse.json(
      { error: "Unable to delete marker" },
      { status: 500 },
    )
  }
}
