import { query, mapMarkerRow } from "./db"
import type { MarkerRow } from "./db"
import { getDistanceKm, getCenterPoint } from "./distance"
import { groupMarkersByVideo } from "./group-markers"
import type { Marker, VideoGroup } from "@/types/markers"

export type NearbyVideo = VideoGroup & {
  distanceKm: number
}

/**
 * Find videos filmed near the current video's locations
 * @param currentVideoMarkers Markers for the current video
 * @param currentVideoUrl URL of the current video (to exclude from results)
 * @param radiusKm Maximum distance in kilometers (default 100km)
 * @param maxResults Maximum number of results to return (default 6)
 * @returns Array of nearby videos sorted by distance
 */
export async function findNearbyVideos(
  currentVideoMarkers: Marker[],
  currentVideoUrl: string,
  radiusKm = 100,
  maxResults = 6
): Promise<NearbyVideo[]> {
  // Fetch all markers except those from the current video
  const { rows } = await query<MarkerRow>(
    `SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, city, video_published_at, screenshot_url, summary, created_at
     FROM explorer_markers
     WHERE video_url IS NOT NULL AND video_url != $1
     ORDER BY created_at DESC`,
    [currentVideoUrl]
  )

  const allOtherMarkers = rows.map(mapMarkerRow)

  // Group markers by video
  const { grouped: allVideos } = groupMarkersByVideo(allOtherMarkers)

  // Calculate center point of current video's locations
  const centerPoint = getCenterPoint(currentVideoMarkers)

  // Find videos within radius
  const nearbyVideos: NearbyVideo[] = []

  for (const video of allVideos) {
    // Calculate minimum distance from center to any location in this video
    const distances = video.locations.map((loc) =>
      getDistanceKm(
        centerPoint.latitude,
        centerPoint.longitude,
        loc.latitude,
        loc.longitude
      )
    )

    const minDistance = Math.min(...distances)

    // Include if within radius
    if (minDistance <= radiusKm) {
      nearbyVideos.push({
        ...video,
        distanceKm: Math.round(minDistance),
      })
    }
  }

  // Sort by distance (closest first), then by publish date (newest first)
  return nearbyVideos
    .sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm
      }
      const dateA = a.videoPublishedAt
        ? new Date(a.videoPublishedAt).getTime()
        : 0
      const dateB = b.videoPublishedAt
        ? new Date(b.videoPublishedAt).getTime()
        : 0
      return dateB - dateA // Newer first
    })
    .slice(0, maxResults)
}
