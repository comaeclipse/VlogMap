import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

type CreatorStatsRow = {
  creator_name: string
  video_count: string
  city_count: string
  location_count: string
  channel_url: string | null
}

export async function GET() {
  try {
    const result = await query<CreatorStatsRow>(`
      SELECT
        c.name as creator_name,
        COUNT(DISTINCT m.video_url) as video_count,
        COUNT(DISTINCT m.city) FILTER (WHERE m.city IS NOT NULL) as city_count,
        COUNT(*) as location_count,
        c.channel_url
      FROM creators c
      LEFT JOIN explorer_markers m ON m.creator_id = c.id
      GROUP BY c.id, c.name, c.channel_url
      ORDER BY video_count DESC, c.name ASC
    `)

    const creators = result.rows.map((row) => ({
      creator: row.creator_name,
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
