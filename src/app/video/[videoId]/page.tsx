import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe2 } from "lucide-react"

import { query, mapMarkerRow } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { getYouTubeThumbnailUrl } from "@/lib/youtube"
import { findNearbyVideos } from "@/lib/nearby-videos"
import { VideoHeader } from "@/components/video/video-header"
import { VideoMapSection } from "@/components/video/video-map-section"
import { PhotoGallery } from "@/components/video/photo-gallery"
import { VideoSummarySection } from "@/components/video/video-summary-section"
import { NearbyVideosSection } from "@/components/video/nearby-videos-section"
import { LocationVideosSection } from "@/components/video/location-videos-section"
import { Button } from "@/components/ui/button"
import type { VideoGroup } from "@/types/markers"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string }>
}): Promise<Metadata> {
  const { videoId } = await params
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  try {
    const { rows } = await query<MarkerRow>(
      `SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, city, video_published_at, screenshot_url, summary, location_id, created_at
       FROM explorer_markers
       WHERE video_url ILIKE $1
       LIMIT 1`,
      [`%${videoId}%`]
    )

    if (rows.length === 0) {
      return { title: "Video Not Found | VlogMap" }
    }

    const marker = mapMarkerRow(rows[0])
    const canonicalVideoUrl = marker.videoUrl || videoUrl
    const description = marker.summary
      ? marker.summary.replace(/<[^>]*>/g, "").slice(0, 160)
      : `Explore ${marker.title} filming locations by ${marker.creator}`

    return {
      title: `${marker.title} - ${marker.creator} | VlogMap`,
      description,
      openGraph: {
        title: marker.title,
        description: `by ${marker.creator}`,
        images: [
          marker.screenshotUrl || getYouTubeThumbnailUrl(canonicalVideoUrl) || "",
        ].filter(Boolean),
      },
    }
  } catch (error) {
    console.error("Failed to generate metadata", error)
    return { title: "Video | VlogMap" }
  }
}

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ videoId: string }>
}) {
  const { videoId } = await params
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  // Fetch markers for this video
  const { rows } = await query<MarkerRow>(
    `SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, city, video_published_at, screenshot_url, summary, location_id, created_at
     FROM explorer_markers
     WHERE video_url ILIKE $1
     ORDER BY created_at ASC`,
    [`%${videoId}%`]
  )

  if (rows.length === 0) {
    notFound()
  }

  const markers = rows.map(mapMarkerRow)
  const canonicalVideoUrl = markers[0]?.videoUrl || videoUrl

  // Get location ID from first marker
  const locationId = markers[0]?.locationId

  // Fetch videos at the same location
  let locationVideos: VideoGroup[] = []
  if (locationId) {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      const locationRes = await fetch(
        `${baseUrl}/api/locations/${locationId}/videos`,
        { cache: "no-store" },
      )
      if (locationRes.ok) {
        const data = await locationRes.json()
        locationVideos = data.videos || []
      }
    } catch (error) {
      console.error("Failed to fetch location videos:", error)
    }
  }

  // Find nearby videos
  const nearbyVideos = await findNearbyVideos(markers, canonicalVideoUrl)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Map
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-sky-200 ring-1 ring-white/10">
              <Globe2 className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">VlogMap</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main>
        <VideoHeader markers={markers} videoId={videoId} />

        {/* Two-column layout */}
        <div className="border-b border-white/10 bg-slate-950">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left column: Map + Photo Gallery */}
              <div className="space-y-6">
                <VideoMapSection markers={markers} />
                <PhotoGallery markers={markers} />
              </div>

              {/* Right column: Video Summary */}
              <div>
                <VideoSummarySection summary={markers[0]?.summary} />
              </div>
            </div>
          </div>
        </div>

        {locationId && locationVideos.length > 0 && (
          <LocationVideosSection
            locationId={locationId}
            videos={locationVideos}
            currentVideoUrl={canonicalVideoUrl}
          />
        )}

        <NearbyVideosSection videos={nearbyVideos} />
      </main>
    </div>
  )
}
