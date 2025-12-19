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
    const { name, type, parentLocationId, latitude, longitude, city, district, country } = body

    // Build dynamic update
    const updates: string[] = []
    const values: (string | number | null)[] = []
    let paramIndex = 1

    if (name !== undefined) {
      if (typeof name !== "string" || name.length > 200) {
        return NextResponse.json(
          { error: "Name must be a string of 200 characters or less" },
          { status: 400 },
        )
      }
      updates.push(`name = $${paramIndex++}`)
      values.push(name || null)
    }

    if (type !== undefined) {
      if (!['city', 'landmark'].includes(type)) {
        return NextResponse.json(
          { error: "Type must be 'city' or 'landmark'" },
          { status: 400 },
        )
      }
      updates.push(`type = $${paramIndex++}`)
      values.push(type)
    }

    if (parentLocationId !== undefined) {
      // Allow null to remove parent
      if (parentLocationId !== null) {
        // Validate parent exists and is a city
        const { rows: parentRows } = await query<{ type: string }>(
          "SELECT type FROM locations WHERE id = $1",
          [parentLocationId]
        )
        if (parentRows.length === 0) {
          return NextResponse.json(
            { error: "Parent location not found" },
            { status: 400 },
          )
        }
        if (parentRows[0].type !== 'city') {
          return NextResponse.json(
            { error: "Parent must be a city" },
            { status: 400 },
          )
        }
      }
      updates.push(`parent_location_id = $${paramIndex++}`)
      values.push(parentLocationId)
    }

    if (latitude !== undefined) {
      updates.push(`latitude = $${paramIndex++}`)
      values.push(latitude)
    }

    if (longitude !== undefined) {
      updates.push(`longitude = $${paramIndex++}`)
      values.push(longitude)
    }

    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`)
      values.push(city || null)
    }

    if (district !== undefined) {
      updates.push(`district = $${paramIndex++}`)
      values.push(district || null)
    }

    if (country !== undefined) {
      updates.push(`country = $${paramIndex++}`)
      values.push(country || null)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      )
    }

    updates.push("updated_at = NOW()")
    values.push(locationId)

    const { rows } = await query<{
      id: string
      name: string | null
      type: string | null
      parent_location_id: string | null
      latitude: number
      longitude: number
      city: string | null
      district: string | null
      country: string | null
    }>(
      `UPDATE locations 
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, name, type, parent_location_id, latitude, longitude, city, district, country`,
      values,
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
      type: rows[0].type,
      parentLocationId: rows[0].parent_location_id,
      latitude: rows[0].latitude,
      longitude: rows[0].longitude,
      city: rows[0].city,
      district: rows[0].district,
      country: rows[0].country,
    })
  } catch (error) {
    console.error("Failed to update location", error)
    return NextResponse.json(
      { error: "Unable to update location" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> },
) {
  const authResult = await requireAdmin(request)
  if (authResult) return authResult

  const { locationId } = await context.params

  try {
    // Check if location has children
    const { rows: childRows } = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM locations WHERE parent_location_id = $1",
      [locationId]
    )
    if (parseInt(childRows[0].count, 10) > 0) {
      return NextResponse.json(
        { error: "Cannot delete location with child locations. Reassign children first." },
        { status: 400 },
      )
    }

    // Unlink any markers from this location
    await query(
      "UPDATE explorer_markers SET location_id = NULL WHERE location_id = $1",
      [locationId]
    )

    // Delete the location
    const { rows } = await query<{ id: string }>(
      "DELETE FROM locations WHERE id = $1 RETURNING id",
      [locationId]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, id: rows[0].id })
  } catch (error) {
    console.error("Failed to delete location", error)
    return NextResponse.json(
      { error: "Unable to delete location" },
      { status: 500 },
    )
  }
}
