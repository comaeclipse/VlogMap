import { NextResponse } from "next/server"
import { query } from "@/lib/db"

type LocationWithStats = {
  id: string
  latitude: number
  longitude: number
  city: string | null
  name: string | null
  createdAt: string
  markerCount: number
  videoCount: number
}

export async function GET() {
  try {
    // Fetch all locations with marker and video counts
    const { rows } = await query<{
      id: string
      latitude: number
      longitude: number
      city: string | null
      name: string | null
      created_at: string
      marker_count: string
      video_count: string
    }>(
      `SELECT
         l.id,
         l.latitude,
         l.longitude,
         l.city,
         l.name,
         l.created_at,
         COUNT(DISTINCT m.id) as marker_count,
         COUNT(DISTINCT m.video_url) FILTER (WHERE m.video_url IS NOT NULL) as video_count
       FROM locations l
       LEFT JOIN explorer_markers m ON l.id = m.location_id
       GROUP BY l.id, l.latitude, l.longitude, l.city, l.name, l.created_at
       ORDER BY video_count DESC, marker_count DESC`,
    )

    const locations: LocationWithStats[] = rows.map((row) => ({
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      city: row.city,
      name: row.name,
      createdAt: row.created_at,
      markerCount: parseInt(row.marker_count, 10),
      videoCount: parseInt(row.video_count, 10),
    }))

    return NextResponse.json({
      locations,
      totalCount: locations.length,
    })
  } catch (error) {
    console.error("Failed to fetch locations", error)
    return NextResponse.json(
      { error: "Unable to load locations" },
      { status: 500 },
    )
  }
}
