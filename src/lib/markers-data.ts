import { query } from "./db"
import type { Marker } from "@/types/markers"

// Slim row for the homepage map: only the columns the map pin + popup render.
// Notably excludes `summary` (up to 10k chars/row and unused on the map) and the
// parent-location join.
type MapMarkerRow = {
  id: number
  title: string
  creator_id: number
  creator_name: string
  channel_url: string | null
  video_url: string | null
  description: string | null
  latitude: number
  longitude: number
  city: string | null
  country: string | null
  screenshot_url: string | null
  location_id: string | null
  location_name: string | null
}

/**
 * Fetch the lightweight marker set used to render the homepage map. Keep this in
 * sync with the fields consumed by `map-canvas.tsx` — if the popup starts
 * showing a new field, add the column here rather than falling back to the full
 * `/api/markers` payload.
 */
export async function getMapMarkers(): Promise<Marker[]> {
  const { rows } = await query<MapMarkerRow>(
    `
    SELECT
      m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url,
      m.video_url, m.description, m.latitude, m.longitude, m.city, m.country,
      m.screenshot_url, m.location_id, l.name as location_name
    FROM explorer_markers m
    JOIN creators c ON m.creator_id = c.id
    LEFT JOIN locations l ON m.location_id = l.id
    ORDER BY m.created_at DESC
    `,
  )

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    channelUrl: row.channel_url,
    videoUrl: row.video_url,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    city: row.city,
    country: row.country,
    screenshotUrl: row.screenshot_url,
    locationId: row.location_id,
    locationName: row.location_name,
  }))
}
