import { NextResponse, type NextRequest } from "next/server"
import { query, mapMarkerRow } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"

type LocationWithMarkers = {
  id: string
  latitude: number
  longitude: number
  city: string | null
  name: string | null
  createdAt: string
  markers: ReturnType<typeof mapMarkerRow>[]
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await context.params

  try {
    // Fetch location details
    const { rows: locationRows } = await query<{
      id: string
      latitude: number
      longitude: number
      city: string | null
      name: string | null
      created_at: string
    }>(
      `SELECT id, latitude, longitude, city, name, created_at
       FROM locations
       WHERE id = $1`,
      [locationId],
    )

    if (locationRows.length === 0) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      )
    }

    const location = locationRows[0]

    // Fetch all markers at this location
    const { rows: markerRows } = await query<MarkerRow>(
      `SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, city, video_published_at, screenshot_url, summary, location_id, created_at
       FROM explorer_markers
       WHERE location_id = $1
       ORDER BY created_at DESC`,
      [locationId],
    )

    const response: LocationWithMarkers = {
      id: location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      name: location.name,
      createdAt: location.created_at,
      markers: markerRows.map(mapMarkerRow),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to fetch location", error)
    return NextResponse.json(
      { error: "Unable to load location" },
      { status: 500 },
    )
  }
}
