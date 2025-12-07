import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { mapMarkerRow, query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { markerSchema } from "@/lib/markers"

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
            video_published_at = $8
        WHERE id = $9
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
        id,
      ],
    )

    if (!rows.length) {
      return NextResponse.json({ error: "Marker not found" }, { status: 404 })
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
    const { rowCount } = await query(
      `DELETE FROM explorer_markers WHERE id = $1`,
      [id],
    )

    if (!rowCount) {
      return NextResponse.json({ error: "Marker not found" }, { status: 404 })
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
