import { NextResponse, type NextRequest } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await context.params

  try {
    const { rows } = await query<{
      id: string
      latitude: number
      longitude: number
      city: string | null
      district: string | null
      country: string | null
      name: string | null
      created_at: string
      updated_at: string
      marker_count: string
      video_count: string
    }>(
      `SELECT 
         l.id,
         l.latitude,
         l.longitude,
         l.city,
         l.district,
         l.country,
         l.name,
         l.created_at,
         l.updated_at,
         COUNT(DISTINCT m.id) as marker_count,
         COUNT(DISTINCT m.video_url) FILTER (WHERE m.video_url IS NOT NULL) as video_count
       FROM locations l
       LEFT JOIN explorer_markers m ON l.id = m.location_id
       WHERE l.id = $1
       GROUP BY l.id, l.latitude, l.longitude, l.city, l.district, l.country, l.name, l.created_at, l.updated_at`,
      [locationId],
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      )
    }

    const location = {
      id: rows[0].id,
      latitude: rows[0].latitude,
      longitude: rows[0].longitude,
      city: rows[0].city,
      district: rows[0].district,
      country: rows[0].country,
      name: rows[0].name,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
      markerCount: parseInt(rows[0].marker_count, 10),
      videoCount: parseInt(rows[0].video_count, 10),
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error("Failed to fetch location", error)
    return NextResponse.json(
      { error: "Unable to load location" },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> },
) {
  const authResult = await requireAdmin(request)
  if (authResult) return authResult

  const { locationId } = await context.params

  try {
    const body = await request.json()
    const { name } = body

    if (name !== undefined && typeof name !== "string") {
      return NextResponse.json(
        { error: "Name must be a string" },
        { status: 400 },
      )
    }

    // Validate name length if provided
    if (name && name.length > 200) {
      return NextResponse.json(
        { error: "Name must be 200 characters or less" },
        { status: 400 },
      )
    }

    const { rows } = await query<{
      id: string
      name: string | null
    }>(
      `UPDATE locations 
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name`,
      [name || null, locationId],
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      )
    }

    return NextResponse.json({
      id: rows[0].id,
      name: rows[0].name,
    })
  } catch (error) {
    console.error("Failed to update location", error)
    return NextResponse.json(
      { error: "Unable to update location" },
      { status: 500 },
    )
  }
}
