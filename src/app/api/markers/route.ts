import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { mapMarkerRow, query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { markerSchema } from "@/lib/markers"
import { assignLocationToMarker } from "@/lib/location-matching"

type MarkerWithLocation = MarkerRow & { 
  location_name: string | null
  parent_city_name: string | null
}

export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get("videoUrl")

  try {
    const { rows } = await query<MarkerWithLocation>(
      `
      SELECT 
        m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, 
        m.video_url, m.description, 
        m.latitude, m.longitude, m.city, m.district, m.country, 
        m.video_published_at, m.screenshot_url, m.summary, m.location_id, 
        m.type, m.parent_city_id, m.timestamp, m.created_at,
        l.name as location_name,
        p.title as parent_city_name
      FROM explorer_markers m
      JOIN creators c ON m.creator_id = c.id
      LEFT JOIN locations l ON m.location_id = l.id
      LEFT JOIN explorer_markers p ON m.parent_city_id = p.id
      ${videoUrl ? "WHERE m.video_url = $1" : ""}
      ORDER BY m.created_at DESC
    `,
      videoUrl ? [videoUrl] : undefined,
    )
    const markers = rows.map((row) => ({
      ...mapMarkerRow(row),
      locationName: row.location_name,
      parentCityName: row.parent_city_name,
    }))
    return NextResponse.json(markers)
  } catch (error) {
    console.error("Failed to fetch markers", error)
    return NextResponse.json(
      { error: "Unable to load markers. Check database connectivity." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    const body = await request.json()
    const payload = markerSchema.parse(body)

    // Validate parent_city_id if provided
    if (payload.parentCityId) {
      const { rows: parentRows } = await query<{ type: string | null }>(
        `SELECT type FROM explorer_markers WHERE id = $1`,
        [payload.parentCityId]
      )
      
      if (parentRows.length === 0) {
        return NextResponse.json(
          { error: "Parent city marker not found" },
          { status: 400 }
        )
      }
      
      if (parentRows[0].type !== 'city') {
        return NextResponse.json(
          { error: "Parent marker must be of type 'city'" },
          { status: 400 }
        )
      }
    }

    // Look up or create creator
    let creatorId: number
    const { rows: existingCreators } = await query<{ id: number }>(
      `SELECT id FROM creators WHERE name = $1`,
      [payload.creatorName]
    )
    
    if (existingCreators.length > 0) {
      creatorId = existingCreators[0].id
      // Update channel_url if provided and different
      if (payload.channelUrl) {
        await query(
          `UPDATE creators SET channel_url = $1 WHERE id = $2`,
          [payload.channelUrl, creatorId]
        )
      }
    } else {
      // Create new creator
      const { rows: newCreators } = await query<{ id: number }>(
        `INSERT INTO creators (name, channel_url) VALUES ($1, $2) RETURNING id`,
        [payload.creatorName, payload.channelUrl ?? null]
      )
      creatorId = newCreators[0].id
    }

    const { rows: insertRows } = await query<{ id: number }>(
      `
        INSERT INTO explorer_markers
          (title, creator_id, video_url, description, latitude, longitude, city, district, country, video_published_at, screenshot_url, summary, type, parent_city_id, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `,
      [
        payload.title,
        creatorId,
        payload.videoUrl ?? null,
        payload.description ?? null,
        payload.latitude,
        payload.longitude,
        payload.city ?? null,
        payload.district ?? null,
        payload.country ?? null,
        payload.videoPublishedAt
          ? new Date(payload.videoPublishedAt).toISOString()
          : null,
        payload.screenshotUrl ?? null,
        payload.summary ?? null,
        payload.type ?? null,
        payload.parentCityId ?? null,
        payload.timestamp ?? null,
      ],
    )

    // Fetch the inserted marker with creator info
    const { rows } = await query<MarkerRow>(
      `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city, m.district, m.country, m.video_published_at, m.screenshot_url, m.summary, m.location_id, m.type, m.parent_city_id, m.timestamp, m.created_at
       FROM explorer_markers m
       JOIN creators c ON m.creator_id = c.id
       WHERE m.id = $1`,
      [insertRows[0].id],
    )

    const marker = rows[0]

    // Auto-assign location ID
    try {
      await assignLocationToMarker(
        marker.id,
        marker.latitude,
        marker.longitude,
        marker.city,
        marker.district,
        marker.country,
      )

      // Fetch updated marker with location_id
      const { rows: updatedRows } = await query<MarkerRow>(
        `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city, m.district, m.country, m.video_published_at, m.screenshot_url, m.summary, m.location_id, m.type, m.parent_city_id, m.timestamp, m.created_at
         FROM explorer_markers m
         JOIN creators c ON m.creator_id = c.id
         WHERE m.id = $1`,
        [marker.id],
      )

      const updatedMarker = updatedRows[0]

      // Update location name if provided and marker has a locationId
      if (payload.locationName && updatedMarker.location_id) {
        await query(
          `UPDATE locations SET name = $1, updated_at = NOW() WHERE id = $2`,
          [payload.locationName, updatedMarker.location_id]
        )
      }

      return NextResponse.json(mapMarkerRow(updatedMarker), { status: 201 })
    } catch (locationError) {
      console.error("Failed to assign location ID:", locationError)
      // Return marker without location_id if assignment fails
      return NextResponse.json(mapMarkerRow(marker), { status: 201 })
    }
  } catch (error) {
    console.error("Failed to create marker", error)
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json(
        { error: "Invalid payload", details: error },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: "Unable to create marker" },
      { status: 500 },
    )
  }
}
