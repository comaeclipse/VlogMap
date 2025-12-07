import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { mapMarkerRow, query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { markerSchema } from "@/lib/markers"

export async function GET() {
  try {
    const { rows } = await query<MarkerRow>(`
      SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, video_published_at, created_at
      FROM explorer_markers
      ORDER BY created_at DESC
    `)
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
          (title, creator, channel_url, video_url, description, latitude, longitude, video_published_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, title, creator, channel_url, video_url, description, latitude, longitude, video_published_at, created_at
      `,
      [
        payload.title,
        payload.creator,
        payload.channelUrl ?? null,
        payload.videoUrl ?? null,
        payload.description ?? null,
        payload.latitude,
        payload.longitude,
        payload.videoPublishedAt ? new Date(payload.videoPublishedAt).toISOString() : null,
      ],
    )

    return NextResponse.json(mapMarkerRow(rows[0]), { status: 201 })
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
