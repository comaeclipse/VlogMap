import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe2, MapPin, Video } from "lucide-react"
import { query } from "@/lib/db"
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

  // Fetch location and markers
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const response = await fetch(`${baseUrl}/api/locations/${locationId}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    notFound()
  }

  const data = await response.json()
  const { grouped: videos } = groupMarkersByVideo(data.markers)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
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

      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <MapPin className="h-4 w-4" />
            <span className="font-mono">{locationId}</span>
          </div>
          <h1 className="text-4xl font-bold">
            {data.name || data.city || "Unknown Location"}
          </h1>
          <p className="mt-2 text-slate-400">
            {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Video className="h-4 w-4 text-blue-400" />
              <span>
                {videos.length} video{videos.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-pink-400" />
              <span>
                {data.markers.length} marker{data.markers.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-4">Videos at This Location</h2>
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
                    <span>{video.creator}</span>
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
