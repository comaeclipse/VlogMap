/**
 * Geographic distance calculation utilities using the Haversine formula
 */

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculate the center point (centroid) of multiple coordinates
 * @param coords Array of coordinate objects with latitude and longitude
 * @returns Center point with latitude and longitude
 */
export function getCenterPoint(
  coords: { latitude: number; longitude: number }[]
): { latitude: number; longitude: number } {
  if (coords.length === 0) {
    return { latitude: 0, longitude: 0 }
  }

  const sum = coords.reduce(
    (acc, coord) => ({
      latitude: acc.latitude + coord.latitude,
      longitude: acc.longitude + coord.longitude,
    }),
    { latitude: 0, longitude: 0 }
  )

  return {
    latitude: sum.latitude / coords.length,
    longitude: sum.longitude / coords.length,
  }
}
