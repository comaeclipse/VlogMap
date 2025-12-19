import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { mapMarkerRow, query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { markerSchema } from "@/lib/markers"
import { assignLocationToMarker } from "@/lib/location-matching"

export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get("videoUrl")

  try {
    const { rows } = await query<MarkerRow>(
      `
      SELECT 
        m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, 
        m.video_url, m.description, 
        m.latitude, m.longitude, m.city, m.district, m.country, 
        m.video_published_at, m.screenshot_url, m.summary, m.location_id, 
        m.timestamp, m.created_at,
        l.name as location_name,
        l.type as location_type,
        l.parent_location_id as parent_location_id,
        pc.name as parent_location_name
      FROM explorer_markers m
      JOIN creators c ON m.creator_id = c.id
      LEFT JOIN locations l ON m.location_id = l.id
      LEFT JOIN locations pc ON l.parent_location_id = pc.id
      ${videoUrl ? "WHERE m.video_url = $1" : ""}
      ORDER BY m.created_at DESC
    `,
      videoUrl ? [videoUrl] : undefined,
    )
    const markers = rows.map(mapMarkerRow)
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
          (title, creator_id, video_url, description, latitude, longitude, city, district, country, video_published_at, screenshot_url, summary, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        payload.timestamp ?? null,
      ],
    )

    const markerId = insertRows[0].id

    // Auto-assign location ID
    try {
      await assignLocationToMarker(
        markerId,
        payload.latitude,
        payload.longitude,
        payload.city ?? null,
        payload.district ?? null,
        payload.country ?? null,
      )

      // Update location name if provided
      if (payload.locationName) {
        // Get the marker's location_id
        const { rows: markerRows } = await query<{ location_id: string | null }>(
          `SELECT location_id FROM explorer_markers WHERE id = $1`,
          [markerId]
        )
        if (markerRows[0]?.location_id) {
          await query(
            `UPDATE locations SET name = $1, updated_at = NOW() WHERE id = $2`,
            [payload.locationName, markerRows[0].location_id]
          )
        }
      }
    } catch (locationError) {
      console.error("Failed to assign location ID:", locationError)
    }

    // Fetch the full marker with all joined data
    const { rows } = await query<MarkerRow>(
      `SELECT 
        m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, 
        m.video_url, m.description, 
        m.latitude, m.longitude, m.city, m.district, m.country, 
        m.video_published_at, m.screenshot_url, m.summary, m.location_id, 
        m.timestamp, m.created_at,
        l.name as location_name,
        l.type as location_type,
        l.parent_location_id as parent_location_id,
        pc.name as parent_location_name
       FROM explorer_markers m
       JOIN creators c ON m.creator_id = c.id
       LEFT JOIN locations l ON m.location_id = l.id
       LEFT JOIN locations pc ON l.parent_location_id = pc.id
       WHERE m.id = $1`,
      [markerId],
    )

    return NextResponse.json(mapMarkerRow(rows[0]), { status: 201 })
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
