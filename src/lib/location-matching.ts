/**
 * Location matching and clustering logic
 * Handles finding nearby locations within 200m threshold
 */

import { query } from "./db"
import { getDistanceKm, getCenterPoint } from "./distance"
import { generateUniqueLocationId } from "./location-id"

const LOCATION_THRESHOLD_KM = 0.2 // 200 meters

export type LocationRow = {
  id: string
  latitude: number
  longitude: number
  city: string | null
  name: string | null
  created_at: string
  updated_at: string
}

/**
 * Find an existing location within 200m of the given coordinates
 * Returns the location ID if found, null otherwise
 */
export async function findNearbyLocation(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  // Fetch all locations (we'll optimize this with spatial indexing in future)
  const { rows } = await query<LocationRow>(
    "SELECT id, latitude, longitude FROM locations",
  )

  // Check each location for proximity
  for (const location of rows) {
    const distance = getDistanceKm(
      latitude,
      longitude,
      location.latitude,
      location.longitude,
    )

    if (distance <= LOCATION_THRESHOLD_KM) {
      return location.id
    }
  }

  return null
}

/**
 * Create a new location with auto-generated ID
 */
export async function createLocation(
  latitude: number,
  longitude: number,
  city?: string | null,
  district?: string | null,
  country?: string | null,
): Promise<string> {
  // Generate unique ID
  const checkExists = async (id: string) => {
    const { rows } = await query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM locations WHERE id = $1) as exists",
      [id],
    )
    return rows[0].exists
  }

  const locationId = await generateUniqueLocationId(checkExists)

  // Insert new location
  await query(
    `INSERT INTO locations (id, latitude, longitude, city, district, country)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      locationId,
      latitude,
      longitude,
      city ?? null,
      district ?? null,
      country ?? null,
    ],
  )

  return locationId
}

/**
 * Recalculate location's centroid based on all associated markers
 * Should be called after markers are added/updated/deleted
 */
export async function updateLocationCentroid(
  locationId: string,
): Promise<void> {
  const { rows } = await query<{ latitude: number; longitude: number }>(
    `SELECT latitude, longitude
     FROM explorer_markers
     WHERE location_id = $1`,
    [locationId],
  )

  if (rows.length === 0) {
    // No markers at this location, delete the location
    await query("DELETE FROM locations WHERE id = $1", [locationId])
    return
  }

  // Calculate centroid
  const center = getCenterPoint(rows)

  // Update location
  await query(
    `UPDATE locations
     SET latitude = $1, longitude = $2, updated_at = NOW()
     WHERE id = $3`,
    [center.latitude, center.longitude, locationId],
  )
}

/**
 * Assign a location ID to a marker
 * Finds nearby location or creates new one
 */
export async function assignLocationToMarker(
  markerId: number,
  latitude: number,
  longitude: number,
  city?: string | null,
  district?: string | null,
  country?: string | null,
): Promise<string> {
  // Try to find existing nearby location
  let locationId = await findNearbyLocation(latitude, longitude)

  // Create new location if none found
  if (!locationId) {
    locationId = await createLocation(latitude, longitude, city, district, country)
  }

  // Update marker with location_id
  await query("UPDATE explorer_markers SET location_id = $1 WHERE id = $2", [
    locationId,
    markerId,
  ])

  // Recalculate centroid (important if adding to existing location)
  await updateLocationCentroid(locationId)

  return locationId
}
