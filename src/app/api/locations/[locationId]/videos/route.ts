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
      `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city, m.district, m.country, m.video_published_at, m.screenshot_url, m.summary, m.location_id, m.type, m.parent_city_id, m.timestamp, m.created_at
       FROM explorer_markers m
       JOIN creators c ON m.creator_id = c.id
       WHERE m.location_id = $1 AND m.video_url IS NOT NULL
       ORDER BY m.video_published_at DESC NULLS LAST, m.created_at DESC`,
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
