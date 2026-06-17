import { query } from "./db"

export type LocationWithStats = {
  id: string
  latitude: number
  longitude: number
  city: string | null
  district: string | null
  country: string | null
  name: string | null
  createdAt: string
  markerCount: number
  videoCount: number
}

type LocationRow = {
  id: string
  latitude: number
  longitude: number
  city: string | null
  district: string | null
  country: string | null
  name: string | null
  created_at: string
  marker_count: string
  video_count: string
}

/**
 * All locations with marker/video counts, used by the server-rendered
 * /locations directory.
 */
export async function getLocationsWithStats(): Promise<LocationWithStats[]> {
  const { rows } = await query<LocationRow>(`
    SELECT
      l.id,
      l.latitude,
      l.longitude,
      l.city,
      l.district,
      l.country,
      l.name,
      l.created_at,
      COUNT(DISTINCT m.id) as marker_count,
      COUNT(DISTINCT m.video_url) FILTER (WHERE m.video_url IS NOT NULL) as video_count
    FROM locations l
    LEFT JOIN explorer_markers m ON l.id = m.location_id
    GROUP BY l.id, l.latitude, l.longitude, l.city, l.district, l.country, l.name, l.created_at
    ORDER BY l.country, l.city, l.name
  `)

  return rows.map((row) => ({
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    city: row.city,
    district: row.district,
    country: row.country,
    name: row.name,
    createdAt: row.created_at,
    markerCount: parseInt(row.marker_count, 10),
    videoCount: parseInt(row.video_count, 10),
  }))
}
