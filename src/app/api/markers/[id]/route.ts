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

    // Get old location_id and coordinates before update
    const { rows: oldRows } = await query<{
      location_id: string | null
      latitude: number
      longitude: number
    }>(
      "SELECT location_id, latitude, longitude FROM explorer_markers WHERE id = $1",
      [id],
    )

    if (!oldRows.length) {
      return NextResponse.json({ error: "Marker not found" }, { status: 404 })
    }

    const oldLocationId = oldRows[0].location_id
    const oldLatitude = oldRows[0].latitude
    const oldLongitude = oldRows[0].longitude

    // Check if coordinates changed significantly (more than 200m ~ 0.002 degrees)
    const coordinatesChanged =
      Math.abs(oldLatitude - payload.latitude) > 0.002 ||
      Math.abs(oldLongitude - payload.longitude) > 0.002

    // Update marker
    const { rows } = await query<MarkerRow>(
      `
        UPDATE explorer_markers
        SET title = $1,
            creator = $2,
            channel_url = $3,
            video_url = $4,
            description = $5,
            latitude = $6,
            longitude = $7,
            city = $8,
            video_published_at = $9,
            screenshot_url = $10,
            summary = $11
        WHERE id = $12
        RETURNING id, title, creator, channel_url, video_url, description, latitude, longitude, city, video_published_at, screenshot_url, summary, location_id, created_at
      `,
      [
        payload.title,
        payload.creator,
        payload.channelUrl ?? null,
        payload.videoUrl ?? null,
        payload.description ?? null,
        payload.latitude,
        payload.longitude,
        payload.city ?? null,
        payload.videoPublishedAt
          ? new Date(payload.videoPublishedAt).toISOString()
          : null,
        payload.screenshotUrl ?? null,
        payload.summary ?? null,
        id,
      ],
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
        )

        // Update centroid of old location (if it exists)
        if (oldLocationId) {
          await updateLocationCentroid(oldLocationId)
        }

        // Fetch updated marker with new location_id
        const { rows: updatedRows } = await query<MarkerRow>(
          `SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, city, video_published_at, screenshot_url, summary, location_id, created_at
           FROM explorer_markers WHERE id = $1`,
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
