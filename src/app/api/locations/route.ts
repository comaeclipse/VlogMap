import { NextResponse, type NextRequest } from "next/server"
import { query } from "@/lib/db"

type LocationWithStats = {
  id: string
  latitude: number
  longitude: number
  city: string | null
  district: string | null
  country: string | null
  name: string | null
  type: string | null
  parentLocationId: string | null
  parentLocationName: string | null
  createdAt: string
  markerCount: number
  videoCount: number
  landmarkCount: number
}

export async function GET(request: NextRequest) {
  const typeFilter = request.nextUrl.searchParams.get("type") // 'city' | 'landmark' | null
  const parentId = request.nextUrl.searchParams.get("parentId") // filter landmarks by city

  try {
    // Build WHERE clause
    const conditions: string[] = []
    const params: (string | null)[] = []
    let paramIndex = 1

    if (typeFilter) {
      conditions.push(`l.type = $${paramIndex++}`)
      params.push(typeFilter)
    }

    if (parentId) {
      conditions.push(`l.parent_location_id = $${paramIndex++}`)
      params.push(parentId)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Fetch all locations with marker, video, and child counts
    const { rows } = await query<{
      id: string
      latitude: number
      longitude: number
      city: string | null
      district: string | null
      country: string | null
      name: string | null
      type: string | null
      parent_location_id: string | null
      parent_location_name: string | null
      created_at: string
      marker_count: string
      video_count: string
      landmark_count: string
    }>(
      `SELECT
         l.id,
         l.latitude,
         l.longitude,
         l.city,
         l.district,
         l.country,
         l.name,
         l.type,
         l.parent_location_id,
         pl.name as parent_location_name,
         l.created_at,
         COUNT(DISTINCT m.id) as marker_count,
         COUNT(DISTINCT m.video_url) FILTER (WHERE m.video_url IS NOT NULL) as video_count,
         (SELECT COUNT(*) FROM locations child WHERE child.parent_location_id = l.id) as landmark_count
       FROM locations l
       LEFT JOIN explorer_markers m ON l.id = m.location_id
       LEFT JOIN locations pl ON l.parent_location_id = pl.id
       ${whereClause}
       GROUP BY l.id, l.latitude, l.longitude, l.city, l.district, l.country, l.name, l.type, l.parent_location_id, pl.name, l.created_at
       ORDER BY l.type DESC, l.country, l.city, l.name`,
      params.length > 0 ? params : undefined,
    )

    const locations: LocationWithStats[] = rows.map((row) => ({
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      city: row.city,
      district: row.district,
      country: row.country,
      name: row.name,
      type: row.type,
      parentLocationId: row.parent_location_id,
      parentLocationName: row.parent_location_name,
      createdAt: row.created_at,
      markerCount: parseInt(row.marker_count, 10),
      videoCount: parseInt(row.video_count, 10),
      landmarkCount: parseInt(row.landmark_count, 10),
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
