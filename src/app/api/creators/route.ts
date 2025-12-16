import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

type CreatorStatsRow = {
  creator: string
  video_count: string
  city_count: string
  location_count: string
  channel_url: string | null
}

export async function GET() {
  try {
    const result = await query<CreatorStatsRow>(`
      SELECT
        creator,
        COUNT(DISTINCT video_url) as video_count,
        COUNT(DISTINCT city) FILTER (WHERE city IS NOT NULL) as city_count,
        COUNT(*) as location_count,
        MAX(channel_url) as channel_url
      FROM explorer_markers
      GROUP BY creator
      ORDER BY video_count DESC, creator ASC
    `)

    const creators = result.rows.map((row) => ({
      creator: row.creator,
      videoCount: parseInt(row.video_count, 10),
      cityCount: parseInt(row.city_count, 10),
      locationCount: parseInt(row.location_count, 10),
      channelUrl: row.channel_url,
    }))

    return NextResponse.json(creators)
  } catch (err: unknown) {
    console.error("Failed to fetch creator stats:", err)
    return NextResponse.json(
      { error: "Failed to fetch creator stats" },
      { status: 500 },
    )
  }
}
