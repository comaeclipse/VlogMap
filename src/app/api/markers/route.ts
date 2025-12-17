import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { mapMarkerRow, query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { markerSchema } from "@/lib/markers"
import { assignLocationToMarker } from "@/lib/location-matching"

export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get("videoUrl")

  try {
    const { rows } = await query<MarkerRow>(
      `
      SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, city, district, country, video_published_at, screenshot_url, summary, location_id, created_at
      FROM explorer_markers
      ${videoUrl ? "WHERE video_url = $1" : ""}
      ORDER BY created_at DESC
    `,
      videoUrl ? [videoUrl] : undefined,
    )
    const markers = rows.map(mapMarkerRow)
    return NextResponse.json(markers)
  } catch (error) {
    console.error("Failed to fetch markers", error)
    return NextResponse.json(
      { error: "Unable to load markers. Check database connectivity." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    const body = await request.json()
    const payload = markerSchema.parse(body)

    const { rows } = await query<MarkerRow>(
      `
        INSERT INTO explorer_markers
          (title, creator, channel_url, video_url, description, latitude, longitude, city, district, country, video_published_at, screenshot_url, summary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, title, creator, channel_url, video_url, description, latitude, longitude, city, district, country, video_published_at, screenshot_url, summary, location_id, created_at
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
        payload.district ?? null,
        payload.country ?? null,
        payload.videoPublishedAt
          ? new Date(payload.videoPublishedAt).toISOString()
          : null,
        payload.screenshotUrl ?? null,
        payload.summary ?? null,
      ],
    )

    const marker = rows[0]

    // Auto-assign location ID
    try {
      await assignLocationToMarker(
        marker.id,
        marker.latitude,
        marker.longitude,
        marker.city,
        marker.district,
        marker.country,
      )

      // Fetch updated marker with location_id
      const { rows: updatedRows } = await query<MarkerRow>(
        `SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, city, district, country, video_published_at, screenshot_url, summary, location_id, created_at
         FROM explorer_markers WHERE id = $1`,
        [marker.id],
      )

      return NextResponse.json(mapMarkerRow(updatedRows[0]), { status: 201 })
    } catch (locationError) {
      console.error("Failed to assign location ID:", locationError)
      // Return marker without location_id if assignment fails
      return NextResponse.json(mapMarkerRow(marker), { status: 201 })
    }
  } catch (error) {
    console.error("Failed to create marker", error)
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json(
        { error: "Invalid payload", details: error },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: "Unable to create marker" },
      { status: 500 },
    )
  }
}
