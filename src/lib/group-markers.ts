import type { Marker, VideoGroup } from "@/types/markers"

export function groupMarkersByVideo(markers: Marker[]): {
  grouped: VideoGroup[]
  uncategorized: Marker[]
} {
  const videoMap = new Map<string, Marker[]>()
  const uncategorized: Marker[] = []

  for (const marker of markers) {
    if (!marker.videoUrl) {
      uncategorized.push(marker)
      continue
    }

    const existing = videoMap.get(marker.videoUrl) || []
    videoMap.set(marker.videoUrl, [...existing, marker])
  }

  const grouped = Array.from(videoMap.entries()).map(([videoUrl, locations]) => {
    const first = locations[0]
    return {
      videoUrl,
      title: first.title,
      creatorName: first.creatorName,
      channelUrl: first.channelUrl,
      videoPublishedAt: first.videoPublishedAt,
      locationCount: locations.length,
      locations: locations.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
    }
  }).sort((a, b) => {
    const dateA = a.videoPublishedAt ? new Date(a.videoPublishedAt).getTime() : 0
    const dateB = b.videoPublishedAt ? new Date(b.videoPublishedAt).getTime() : 0
    return dateB - dateA
  })

  return { grouped, uncategorized }
}
