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
 * Find or create a canonical city location
 */
export async function findOrCreateCity(
  city: string,
  country?: string | null,
  district?: string | null,
  latitude?: number,
  longitude?: number,
): Promise<string> {
  // Try to find existing city
  const { rows: existingCities } = await query<{ id: string }>(
    `SELECT id FROM locations WHERE type = 'city' AND city = $1 LIMIT 1`,
    [city]
  )

  if (existingCities.length > 0) {
    return existingCities[0].id
  }

  // Create new city with hash-based ID
  const cityId = `city-${Buffer.from(city + (country ?? '')).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`
  
  await query(
    `INSERT INTO locations (id, name, latitude, longitude, city, district, country, type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'city')
     ON CONFLICT (id) DO NOTHING`,
    [
      cityId,
      city,
      latitude ?? 0,
      longitude ?? 0,
      city,
      district ?? null,
      country ?? null,
    ],
  )

  return cityId
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

  // Find or create parent city if city is provided
  let parentLocationId: string | null = null
  if (city) {
    parentLocationId = await findOrCreateCity(city, country, district, latitude, longitude)
  }

  // Count existing landmarks in this city for auto-naming
  // Format: "Paris 1", "Paris 2", etc. - each city has its own numbering
  let locationName = 'Location 1'
  if (parentLocationId && city) {
    const { rows: countRows } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM locations WHERE parent_location_id = $1 AND type = 'landmark'`,
      [parentLocationId]
    )
    const count = parseInt(countRows[0].count, 10) + 1
    locationName = `${city} ${count}`
  } else if (city) {
    // No parent but city is known - start at 1
    locationName = `${city} 1`
  }

  // Insert new location as landmark
  await query(
    `INSERT INTO locations (id, name, latitude, longitude, city, district, country, type, parent_location_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'landmark', $8)`,
    [
      locationId,
      locationName,
      latitude,
      longitude,
      city ?? null,
      district ?? null,
      country ?? null,
      parentLocationId,
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

/**
 * Create a new landmark location under a specific parent city
 * Used when switching a marker from city to landmark type
 */
async function createLandmarkUnderCity(
  parentCityId: string,
  lat: number,
  lng: number,
  cityName: string,
  district?: string | null,
  country?: string | null,
): Promise<string> {
  // Generate unique location ID
  const checkExists = async (id: string) => {
    const { rows } = await query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM locations WHERE id = $1) as exists",
      [id],
    )
    return rows[0].exists
  }

  const locationId = await generateUniqueLocationId(checkExists)

  // Get next number for this city's landmarks
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM locations
     WHERE parent_location_id = $1
     AND name LIKE $2`,
    [parentCityId, `${cityName} %`],
  )

  const nextNumber = parseInt(rows[0]?.count || '0', 10) + 1
  const landmarkName = `${cityName} ${nextNumber}`

  // Create landmark location
  await query(
    `INSERT INTO locations (id, name, type, latitude, longitude, city, district, country, parent_location_id, created_at, updated_at)
     VALUES ($1, $2, 'landmark', $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [locationId, landmarkName, lat, lng, cityName, district ?? null, country ?? null, parentCityId],
  )

  return locationId
}

/**
 * Switch a marker's location type between city and landmark
 * - City → Landmark: Creates new landmark under the city
 * - Landmark → City: Points marker to parent city
 * Returns the new location ID
 */
export async function switchMarkerLocationType(
  markerId: number,
  currentLocationId: string,
  newType: 'city' | 'landmark',
  markerLat: number,
  markerLng: number,
  cityName: string,
  district?: string | null,
  country?: string | null,
): Promise<string> {
  // Get current location details
  const { rows: locationRows } = await query<{
    id: string
    type: string
    parent_location_id: string | null
    city: string | null
    district: string | null
    country: string | null
  }>(
    'SELECT id, type, parent_location_id, city, district, country FROM locations WHERE id = $1',
    [currentLocationId],
  )

  if (locationRows.length === 0) {
    throw new Error(`Location ${currentLocationId} not found`)
  }

  const currentLocation = locationRows[0]
  let newLocationId: string

  if (newType === 'city' && currentLocation.type === 'landmark') {
    // LANDMARK → CITY: Point to parent city
    if (!currentLocation.parent_location_id) {
      throw new Error('Landmark has no parent city - cannot convert to city type')
    }
    newLocationId = currentLocation.parent_location_id

  } else if (newType === 'landmark' && currentLocation.type === 'city') {
    // CITY → LANDMARK: Create new landmark under this city
    const parentCityId = currentLocationId

    // Create new landmark at marker's coordinates
    newLocationId = await createLandmarkUnderCity(
      parentCityId,
      markerLat,
      markerLng,
      cityName,
      district || currentLocation.district,
      country || currentLocation.country,
    )
  } else {
    // No change needed (same type)
    return currentLocationId
  }

  // Update marker to point to new location
  await query(
    'UPDATE explorer_markers SET location_id = $1 WHERE id = $2',
    [newLocationId, markerId],
  )

  // Update both locations' centroids
  await updateLocationCentroid(currentLocationId)
  await updateLocationCentroid(newLocationId)

  return newLocationId
}
