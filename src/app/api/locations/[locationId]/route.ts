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
      description: string | null
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
         l.description,
         l.created_at,
         l.updated_at,
         COUNT(DISTINCT m.id) as marker_count,
         COUNT(DISTINCT m.video_url) FILTER (WHERE m.video_url IS NOT NULL) as video_count
       FROM locations l
       LEFT JOIN explorer_markers m ON l.id = m.location_id
       WHERE l.id = $1
       GROUP BY l.id, l.latitude, l.longitude, l.city, l.district, l.country, l.name, l.description, l.created_at, l.updated_at`,
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
      description: rows[0].description,
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
    const { name, type, parentLocationId, latitude, longitude, city, district, country, description } = body

    // Load the current row up front: powers the early 404, the resulting-type
    // check, and the parent-cycle guard below.
    const { rows: currentRows } = await query<{
      type: string | null
      parent_location_id: string | null
    }>(
      "SELECT type, parent_location_id FROM locations WHERE id = $1",
      [locationId],
    )
    if (currentRows.length === 0) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }
    const current = currentRows[0]
    // The location's type after this update (type may or may not be changing).
    const resultingType = type !== undefined ? type : current.type

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

    // Resolve parent_location_id with tree-integrity guards: a city must have no
    // parent; a landmark's parent must be an existing city; no self-parenting
    // and no cycles. `undefined` means "leave parent untouched"; it is written
    // at most once.
    let parentClauseValue: string | null | undefined = undefined

    if (parentLocationId !== undefined && parentLocationId !== null) {
      if (resultingType === 'city') {
        return NextResponse.json(
          { error: "A city cannot have a parent" },
          { status: 400 },
        )
      }
      if (parentLocationId === locationId) {
        return NextResponse.json(
          { error: "A location cannot be its own parent" },
          { status: 400 },
        )
      }
      // Parent must exist and be a city.
      const { rows: parentRows } = await query<{ type: string | null }>(
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
      // Cycle guard: walk ancestors of the proposed parent; reaching this
      // location means the new edge would create a cycle. The `seen` set keeps
      // us safe against any pre-existing cyclic data. (Pattern mirrors
      // mergeLocations in src/lib/location-matching.ts.)
      let ancestor: string | null = parentLocationId
      const seen = new Set<string>()
      while (ancestor) {
        if (ancestor === locationId) {
          return NextResponse.json(
            { error: "Cannot set parent: would create a circular relationship" },
            { status: 400 },
          )
        }
        if (seen.has(ancestor)) break
        seen.add(ancestor)
        const { rows: ancRows } = await query<{ parent_location_id: string | null }>(
          "SELECT parent_location_id FROM locations WHERE id = $1",
          [ancestor]
        )
        ancestor = ancRows[0]?.parent_location_id ?? null
      }
      parentClauseValue = parentLocationId
    } else if (parentLocationId === null) {
      // Explicit clear.
      parentClauseValue = null
    }

    // A location being (re)set to type 'city' must not keep a parent (#11:
    // bulk "Set type → City" never cleared it). Scoped to an explicit
    // type==='city' change so unrelated city edits don't silently mutate.
    if (type === 'city' && parentClauseValue === undefined) {
      parentClauseValue = null
    }

    if (parentClauseValue !== undefined) {
      updates.push(`parent_location_id = $${paramIndex++}`)
      values.push(parentClauseValue)
    }

    if (latitude !== undefined) {
      const lat = Number(latitude)
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return NextResponse.json(
          { error: "Latitude must be a number between -90 and 90" },
          { status: 400 },
        )
      }
      updates.push(`latitude = $${paramIndex++}`)
      values.push(lat)
    }

    if (longitude !== undefined) {
      const lng = Number(longitude)
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return NextResponse.json(
          { error: "Longitude must be a number between -180 and 180" },
          { status: 400 },
        )
      }
      updates.push(`longitude = $${paramIndex++}`)
      values.push(lng)
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

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return NextResponse.json(
          { error: "Description must be a string" },
          { status: 400 },
        )
      }
      updates.push(`description = $${paramIndex++}`)
      values.push(description || null)
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
      description: string | null
    }>(
      `UPDATE locations
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, name, type, parent_location_id, latitude, longitude, city, district, country, description`,
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
      description: rows[0].description,
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
