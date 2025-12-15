import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe2, MapPin, User } from "lucide-react"

import { query, mapMarkerRow } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { groupMarkersByVideo } from "@/lib/group-markers"
import { extractYouTubeId, getYouTubeThumbnailUrl } from "@/lib/youtube"
import { Button } from "@/components/ui/button"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ creatorName: string }>
}): Promise<Metadata> {
  const { creatorName } = await params
  const decodedName = decodeURIComponent(creatorName)

  return {
    title: `${decodedName} - Videos | VlogMap`,
    description: `Explore all filming locations from ${decodedName}'s videos`,
  }
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ creatorName: string }>
}) {
  const { creatorName } = await params
  const decodedName = decodeURIComponent(creatorName)

  // Fetch all markers for this creator
  const { rows } = await query<MarkerRow>(
    `SELECT id, title, creator, channel_url, video_url, description, latitude, longitude, city, video_published_at, screenshot_url, summary, created_at
     FROM explorer_markers
     WHERE creator = $1
     ORDER BY created_at DESC`,
    [decodedName]
  )

  if (rows.length === 0) {
    notFound()
  }

  const markers = rows.map(mapMarkerRow)

  // Group by video
  const { grouped: videos } = groupMarkersByVideo(markers)

  const channelUrl = markers[0]?.channelUrl

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
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Creator Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-sky-200" />
            <h1 className="text-3xl font-bold md:text-4xl">{decodedName}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <p>
              {videos.length} video{videos.length !== 1 ? "s" : ""} ·{" "}
              {markers.length} location{markers.length !== 1 ? "s" : ""}
            </p>
            {channelUrl && (
              <Button variant="secondary" size="sm" asChild>
                <a href={channelUrl} target="_blank" rel="noopener noreferrer">
                  Visit Channel
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Video Grid */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Videos</h2>
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
                      <img
                        src={thumbnailUrl}
                        alt={video.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          if (target.src.includes("maxresdefault")) {
                            target.src = target.src.replace(
                              "maxresdefault",
                              "hqdefault"
                            )
                          }
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-2 p-4">
                    <h3 className="font-semibold text-slate-50 line-clamp-2 group-hover:text-white">
                      {video.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      {formattedDate && <span>{formattedDate}</span>}
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-pink-300" />
                        <span>
                          {video.locationCount} location
                          {video.locationCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
