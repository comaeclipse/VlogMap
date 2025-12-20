import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Globe2, MapPin, Video, Users, Camera, Navigation, ChevronRight } from "lucide-react"
import { query, mapMarkerRow } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { groupMarkersByVideo } from "@/lib/group-markers"
import { extractYouTubeId, getYouTubeThumbnailUrl } from "@/lib/youtube"
import { Button } from "@/components/ui/button"
import { VideoThumbnail } from "@/components/video-thumbnail"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locationId: string }>
}): Promise<Metadata> {
  const { locationId } = await params

  try {
    const { rows } = await query<{ city: string | null; name: string | null }>(
      "SELECT city, name FROM locations WHERE id = $1",
      [locationId],
    )

    if (rows.length === 0) {
      return { title: "Location Not Found | VlogMap" }
    }

    const location = rows[0]
    const title = location.name || location.city || `Location ${locationId}`

    return {
      title: `${title} | VlogMap`,
      description: `Videos filmed at ${title}`,
    }
  } catch (error) {
    console.error("Failed to generate metadata", error)
    return { title: "Location | VlogMap" }
  }
}

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params

  // Fetch location details with parent city info
  const { rows: locationRows } = await query<{
    id: string
    latitude: number
    longitude: number
    city: string | null
    district: string | null
    country: string | null
    name: string | null
    type: string | null
    parent_location_id: string | null
    parent_city_name: string | null
    created_at: string
  }>(
    `SELECT l.id, l.latitude, l.longitude, l.city, l.district, l.country, l.name, l.type, 
            l.parent_location_id, pc.name as parent_city_name, l.created_at
     FROM locations l
     LEFT JOIN locations pc ON l.parent_location_id = pc.id
     WHERE l.id = $1`,
    [locationId],
  )

  if (locationRows.length === 0) {
    notFound()
  }

  const location = locationRows[0]

  // Fetch all markers at this location
  // For cities, include both direct city markers AND markers from child landmarks
  // For landmarks, only fetch markers directly at that landmark
  const markerQuery = location.type === 'city'
    ? `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city,
       COALESCE(m.district, l.district) as district,
       COALESCE(m.country, l.country) as country,
       m.video_published_at, m.screenshot_url, m.summary, m.location_id, m.type, m.parent_city_id, m.timestamp, m.created_at
       FROM explorer_markers m
       JOIN creators c ON m.creator_id = c.id
       LEFT JOIN locations l ON m.location_id = l.id
       WHERE m.location_id = $1
          OR m.location_id IN (SELECT id FROM locations WHERE parent_location_id = $1)
       ORDER BY m.created_at DESC`
    : `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city,
       COALESCE(m.district, l.district) as district,
       COALESCE(m.country, l.country) as country,
       m.video_published_at, m.screenshot_url, m.summary, m.location_id, m.type, m.parent_city_id, m.timestamp, m.created_at
       FROM explorer_markers m
       JOIN creators c ON m.creator_id = c.id
       LEFT JOIN locations l ON m.location_id = l.id
       WHERE m.location_id = $1
       ORDER BY m.created_at DESC`

  const { rows: markerRows } = await query<MarkerRow>(markerQuery, [locationId])

  const markers = markerRows.map(mapMarkerRow)
  const { grouped: videos } = groupMarkersByVideo(markers)

  // Get unique screenshots for photo gallery
  const screenshots = markers
    .filter(m => m.screenshotUrl)
    .map(m => ({
      url: m.screenshotUrl!,
      title: m.title,
      creatorName: m.creatorName,
      videoUrl: m.videoUrl,
    }))

  // Get unique creators who visited this location
  const uniqueCreators = [...new Set(markers.map(m => m.creatorName))]

  // For cities, fetch child landmarks
  let childLandmarks: Array<{ id: string; name: string; markerCount: number }> = []
  if (location.type === 'city') {
    const { rows: landmarkRows } = await query<{ 
      id: string
      name: string
      marker_count: string
    }>(
      `SELECT l.id, l.name, COUNT(m.id) as marker_count
       FROM locations l
       LEFT JOIN explorer_markers m ON l.id = m.location_id
       WHERE l.parent_location_id = $1
       GROUP BY l.id, l.name
       HAVING COUNT(m.id) > 0
       ORDER BY COUNT(m.id) DESC, l.name`,
      [locationId]
    )
    childLandmarks = landmarkRows.map(row => ({
      id: row.id,
      name: row.name,
      markerCount: parseInt(row.marker_count, 10)
    }))
  }

  const data = {
    ...location,
    markers,
    parentLocationId: location.parent_location_id,
    parentCityName: location.parent_city_name,
    locationType: location.type,
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sky-200 ring-1 ring-white/10">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Vlog map
                </p>
                <h1 className="text-lg font-semibold text-white">Explorer</h1>
              </div>
            </Link>
            <Link href="/creators">
              <Button variant="ghost" className="gap-2 text-slate-300 hover:text-white">
                <Users className="h-4 w-4" />
                Creators
              </Button>
            </Link>
            <Link href="/locations">
              <Button variant="ghost" className="gap-2 text-slate-300 hover:text-white">
                <MapPin className="h-4 w-4" />
                Locations
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Breadcrumb for landmarks */}
        {data.parentLocationId && data.parentCityName && (
          <div className="mb-4">
            <Link 
              href={`/location/${data.parentLocationId}`}
              className="inline-flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
            >
              <Navigation className="h-4 w-4" />
              <span>{data.parentCityName}</span>
              <span className="text-slate-500">›</span>
            </Link>
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <MapPin className="h-4 w-4" />
            <span className="px-2 py-0.5 rounded bg-slate-800 text-xs">
              {data.locationType === 'city' ? 'City' : 'Landmark'}
            </span>
          </div>
          <h1 className="text-4xl font-bold">
            {data.name || data.city || "Unnamed Location"}
          </h1>
          {(data.city || data.country) && (
            <p className="mt-2 text-lg text-slate-300">
              {[data.city, data.country].filter(Boolean).join(", ")}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">
            {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}
          </p>
        </div>

        {/* Stats row - Foursquare style */}
        <div className="mb-8 p-4 rounded-lg bg-slate-900/60 border border-white/10">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-blue-500/20">
                <Video className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{videos.length}</p>
                <p className="text-slate-400 text-xs">Video{videos.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-pink-500/20">
                <Users className="h-4 w-4 text-pink-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{uniqueCreators.length}</p>
                <p className="text-slate-400 text-xs">Creator{uniqueCreators.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-emerald-500/20">
                <Camera className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{screenshots.length}</p>
                <p className="text-slate-400 text-xs">Photo{screenshots.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Photo Gallery - Foursquare style */}
        {screenshots.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-400" />
              Photos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {screenshots.slice(0, 8).map((screenshot, idx) => {
                const videoId = screenshot.videoUrl ? extractYouTubeId(screenshot.videoUrl) : null
                return (
                  <Link
                    key={idx}
                    href={videoId ? `/video/${videoId}` : '#'}
                    className="group relative aspect-video overflow-hidden rounded-lg bg-slate-800"
                  >
                    <VideoThumbnail
                      src={screenshot.url}
                      alt={screenshot.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white/90 truncate">{screenshot.creatorName}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
            {screenshots.length > 8 && (
              <p className="mt-3 text-sm text-slate-400">
                +{screenshots.length - 8} more photos
              </p>
            )}
          </div>
        )}

        {/* Landmarks in this city */}
        {data.locationType === 'city' && childLandmarks.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-pink-400" />
              Places in {data.name || data.city}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {childLandmarks.map((landmark) => (
                <Link
                  key={landmark.id}
                  href={`/location/${landmark.id}`}
                  className="group flex items-center justify-between p-4 rounded-lg bg-slate-900/60 border border-white/10 hover:border-white/20 hover:bg-slate-900 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-pink-500/20">
                      <MapPin className="h-4 w-4 text-pink-400" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-50 group-hover:text-white">
                        {landmark.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {landmark.markerCount} visit{landmark.markerCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300" />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-4">
            {data.locationType === 'city' ? 'Videos in This City' : 'Videos at This Location'}
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => {
            const videoId = extractYouTubeId(video.videoUrl)
            const thumbnailUrl =
              video.locations[0]?.screenshotUrl ||
              getYouTubeThumbnailUrl(video.videoUrl)

            const formattedDate = video.videoPublishedAt
              ? new Date(video.videoPublishedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : null

            return (
              <Link
                key={video.videoUrl}
                href={`/video/${videoId}`}
                className="group overflow-hidden rounded-lg border border-white/10 bg-slate-900/60 transition-all hover:border-white/20 hover:bg-slate-900"
              >
                {thumbnailUrl && (
                  <div className="relative aspect-video overflow-hidden bg-slate-800">
                    <VideoThumbnail
                      src={thumbnailUrl}
                      alt={video.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                )}

                <div className="space-y-2 p-4">
                  <h3 className="font-semibold text-slate-50 line-clamp-2 group-hover:text-white">
                    {video.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{video.creatorName}</span>
                    {formattedDate && (
                      <>
                        <span>·</span>
                        <span>{formattedDate}</span>
                      </>
                    )}
                    {video.locationCount > 1 && (
                      <>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-pink-300" />
                          <span>{video.locationCount} locations</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
