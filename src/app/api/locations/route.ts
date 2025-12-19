import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { generateUniqueLocationId } from "@/lib/location-id"

// Schema for creating a location
const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['city', 'landmark']),
  latitude: z.coerce.number().min(-90).max(90).optional().default(0),
  longitude: z.coerce.number().min(-180).max(180).optional().default(0),
  city: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  parentLocationId: z.string().optional().nullable(),
})

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

export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    const body = await request.json()
    const payload = createLocationSchema.parse(body)

    // Generate unique ID
    const checkExists = async (id: string) => {
      const { rows } = await query<{ exists: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM locations WHERE id = $1) as exists",
        [id],
      )
      return rows[0].exists
    }
    const locationId = await generateUniqueLocationId(checkExists)

    // For cities, use name as city field; for landmarks, inherit from parent or use provided
    let cityValue: string | null = payload.city || null
    let districtValue: string | null = payload.district || null
    let countryValue: string | null = payload.country || null

    if (payload.type === 'city') {
      cityValue = payload.name
    } else if (payload.parentLocationId) {
      // Inherit city/district/country from parent if not provided
      const { rows: parentRows } = await query<{ city: string | null; district: string | null; country: string | null }>(
        "SELECT city, district, country FROM locations WHERE id = $1",
        [payload.parentLocationId]
      )
      if (parentRows.length > 0) {
        cityValue = cityValue || parentRows[0].city
        districtValue = districtValue || parentRows[0].district
        countryValue = countryValue || parentRows[0].country
      }
    }

    // Insert location
    const { rows } = await query<{
      id: string
      name: string
      type: string
      latitude: number
      longitude: number
      city: string | null
      district: string | null
      country: string | null
      parent_location_id: string | null
      created_at: string
    }>(
      `INSERT INTO locations (id, name, type, latitude, longitude, city, district, country, parent_location_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, type, latitude, longitude, city, district, country, parent_location_id, created_at`,
      [
        locationId,
        payload.name,
        payload.type,
        payload.latitude,
        payload.longitude,
        cityValue || null,
        districtValue || null,
        countryValue || null,
        payload.parentLocationId || null,
      ]
    )

    const location = rows[0]
    return NextResponse.json({
      id: location.id,
      name: location.name,
      type: location.type,
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      district: location.district,
      country: location.country,
      parentLocationId: location.parent_location_id,
      createdAt: location.created_at,
    }, { status: 201 })

  } catch (error) {
    console.error("Failed to create location", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Unable to create location" },
      { status: 500 },
    )
  }
}
