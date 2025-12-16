import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe2, MapPin, Video, Compass } from "lucide-react"

import { query, mapMarkerRow } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { groupMarkersByVideo } from "@/lib/group-markers"
import { extractYouTubeId, getYouTubeThumbnailUrl } from "@/lib/youtube"
import { getCreatorGradient } from "@/lib/gradients"
import { Button } from "@/components/ui/button"
import { VideoThumbnail } from "@/components/video-thumbnail"
import styles from "./page.module.css"

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
  const gradient = getCreatorGradient(decodedName)

  // Get unique cities
  const uniqueCities = new Set(markers.map(m => m.city).filter(Boolean))
  const cityCount = uniqueCities.size

  return (
    <div className="min-h-screen bg-[#0a0e14] text-slate-50">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0e14]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/creators">
            <Button variant="ghost" className="gap-2 text-slate-400 hover:text-white hover:bg-white/5">
              <ArrowLeft className="h-4 w-4" />
              All Explorers
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-pink-500/20 text-blue-200 ring-1 ring-white/10">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-slate-300">Atlas</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className={`${styles.creatorPage} ${styles.atlasBg} ${styles.noiseTexture} relative mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16`}>
        {/* Creator Header */}
        <div className="mb-12 space-y-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
            {/* Avatar */}
            <div className="relative">
              <div
                className={`${styles.creatorAvatarGlow} h-24 w-24 rounded-full border-2 border-white/20 md:h-32 md:w-32`}
                style={{ background: gradient }}
              />
              {/* Glow background */}
              <div
                className="absolute inset-0 -z-10 scale-150 rounded-full opacity-30 blur-3xl"
                style={{ background: gradient }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className={`${styles.creatorTitle} text-4xl font-bold text-white md:text-5xl lg:text-6xl`}>
                  {decodedName}
                </h1>
                <p className="mt-2 text-lg text-slate-400">Explorer & Content Creator</p>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-3">
                <div className={`${styles.statBadge} flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 backdrop-blur`}>
                  <Video className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-slate-200">
                    {videos.length} video{videos.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className={`${styles.statBadge} flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 backdrop-blur`}>
                  <MapPin className="h-4 w-4 text-pink-400" />
                  <span className="text-sm font-medium text-slate-200">
                    {markers.length} location{markers.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {cityCount > 0 && (
                  <div className={`${styles.statBadge} flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 backdrop-blur`}>
                    <Globe2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-slate-200">
                      {cityCount} {cityCount === 1 ? "city" : "cities"}
                    </span>
                  </div>
                )}
                {channelUrl && (
                  <a
                    href={channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.statBadge} flex items-center gap-2 rounded-xl border border-white/10 bg-gradient-to-br from-red-500/20 to-pink-500/20 px-4 py-2 backdrop-blur transition-all hover:from-red-500/30 hover:to-pink-500/30`}
                  >
                    <span className="text-sm font-medium text-white">YouTube Channel</span>
                    <span className="text-xs">↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Video Grid */}
        <div className="space-y-6">
          <div className="border-b border-white/5 pb-4">
            <h2 className={`${styles.creatorTitle} text-3xl font-bold text-white md:text-4xl`}>
              Video Collection
            </h2>
            <p className="mt-2 text-slate-400">
              Documenting adventures across {cityCount} {cityCount === 1 ? "location" : "locations"}
            </p>
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
                  className={`${styles.videoCard} group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm transition-all hover:border-white/10`}
                  style={{
                    boxShadow: '0 4px 24px -2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {thumbnailUrl && (
                    <div className="relative aspect-video overflow-hidden bg-slate-800">
                      <VideoThumbnail
                        src={thumbnailUrl}
                        alt={video.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-x-0 top-0 -bottom-1 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>
                  )}

                  <div className="relative space-y-3 p-5">
                    <h3 className={`${styles.creatorTitle} text-lg font-semibold text-slate-50 line-clamp-2 transition-colors group-hover:text-white`}>
                      {video.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {formattedDate && (
                        <span className="rounded bg-black/20 px-2 py-1">{formattedDate}</span>
                      )}
                      <div className="flex items-center gap-1.5 rounded bg-pink-500/10 px-2 py-1">
                        <MapPin className="h-3 w-3 text-pink-400" />
                        <span className="text-pink-300">
                          {video.locationCount} pin{video.locationCount !== 1 ? "s" : ""}
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
