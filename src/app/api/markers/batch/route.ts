import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { mapMarkerRow, query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { batchUpdateSchema } from "@/lib/markers"

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
        const { rows } = await query<MarkerRow>(
          `UPDATE explorer_markers
           SET latitude = $1, longitude = $2, description = $3, city = $4
           WHERE id = $5
           RETURNING id, title, creator, channel_url, video_url, description, latitude, longitude, city, video_published_at, created_at`,
          [
            update.latitude,
            update.longitude,
            update.description ?? null,
            update.city ?? null,
            update.id,
          ]
        )

        updatedMarkers.push(rows[0])
      }

      await query("COMMIT")

      return NextResponse.json(updatedMarkers.map(mapMarkerRow))
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
