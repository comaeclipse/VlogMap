import { NextResponse, type NextRequest } from "next/server"
import { query, mapMarkerRow } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { groupMarkersByVideo } from "@/lib/group-markers"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await context.params

  try {
    // Fetch all markers at this location
    const { rows } = await query<MarkerRow>(
      `SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, city, video_published_at, screenshot_url, summary, location_id, created_at
       FROM explorer_markers
       WHERE location_id = $1 AND video_url IS NOT NULL
       ORDER BY video_published_at DESC NULLS LAST, created_at DESC`,
      [locationId],
    )

    const markers = rows.map(mapMarkerRow)

    // Group by video
    const { grouped: videos } = groupMarkersByVideo(markers)

    return NextResponse.json({
      locationId,
      videoCount: videos.length,
      videos,
    })
  } catch (error) {
    console.error("Failed to fetch location videos", error)
    return NextResponse.json(
      { error: "Unable to load videos for this location" },
      { status: 500 },
    )
  }
}
