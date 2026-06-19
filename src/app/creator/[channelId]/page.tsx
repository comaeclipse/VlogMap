import { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import Link from "next/link"
import { Globe2, MapPin, Video, Users } from "lucide-react"

import { query, mapMarkerRow } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { groupMarkersByVideo } from "@/lib/group-markers"
import { extractYouTubeId, getYouTubeThumbnailUrl } from "@/lib/youtube"
import { getCreatorGradient } from "@/lib/gradients"
import { Button } from "@/components/ui/button"
import { VideoThumbnail } from "@/components/video-thumbnail"
import { SiteFooter } from "@/components/site-footer"
import styles from "./page.module.css"

type CreatorRow = {
  id: number
  name: string
  channel_url: string | null
  channel_id: string | null
  handle: string | null
  avatar_url: string | null
}

// Resolve a creator by canonical channel id first, falling back to name so old
// /creator/<name> links keep working.
async function findCreator(identifier: string): Promise<CreatorRow | null> {
  const { rows } = await query<CreatorRow>(
    `SELECT id, name, channel_url, channel_id, handle, avatar_url
       FROM creators
      WHERE channel_id = $1 OR name = $1
      LIMIT 1`,
    [identifier],
  )
  return rows[0] ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channelId: string }>
}): Promise<Metadata> {
  const { channelId } = await params
  const creator = await findCreator(decodeURIComponent(channelId))
  const name = creator?.name ?? "Creator"

  return {
    title: `${name} - Videos | VlogMap`,
    description: `Explore all filming locations from ${name}'s videos`,
  }
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ channelId: string }>
}) {
  const { channelId } = await params
  const identifier = decodeURIComponent(channelId)

  const creator = await findCreator(identifier)
  if (!creator) {
    notFound()
  }

  // Canonicalize on the channel id: if reached via name (or anything that isn't
  // the channel id) and we know the channel id, redirect to it.
  if (creator.channel_id && identifier !== creator.channel_id) {
    permanentRedirect(`/creator/${encodeURIComponent(creator.channel_id)}`)
  }

  // Fetch all markers for this creator
  const { rows } = await query<MarkerRow>(
    `SELECT m.id, m.title, m.creator_id, c.name as creator_name, c.channel_url, m.video_url, m.description, m.latitude, m.longitude, m.city, m.video_published_at, m.screenshot_url, m.summary, m.created_at
     FROM explorer_markers m
     JOIN creators c ON m.creator_id = c.id
     WHERE m.creator_id = $1
     ORDER BY m.created_at DESC`,
    [creator.id],
  )

  if (rows.length === 0) {
    notFound()
  }

  const markers = rows.map(mapMarkerRow)

  // Group by video
  const { grouped: videos } = groupMarkersByVideo(markers)

  const channelUrl = creator.channel_url ?? markers[0]?.channelUrl
  const avatarUrl = creator.avatar_url
  const gradient = getCreatorGradient(creator.name)

  // Get unique cities
  const uniqueCities = new Set(markers.map(m => m.city).filter(Boolean))
  const cityCount = uniqueCities.size

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">

      {/* Header */}
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

      {/* Content */}
      <main className={`${styles.creatorPage} ${styles.atlasBg} ${styles.noiseTexture} relative mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16`}>
        {/* Creator Header */}
        <div className="mb-12 space-y-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
            {/* Avatar — channel logo when available, else creator gradient */}
            <div className="relative">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={`${creator.name} channel logo`}
                  className={`${styles.creatorAvatarGlow} h-24 w-24 rounded-full border-2 border-white/20 object-cover md:h-32 md:w-32`}
                />
              ) : (
                <div
                  className={`${styles.creatorAvatarGlow} h-24 w-24 rounded-full border-2 border-white/20 md:h-32 md:w-32`}
                  style={{ background: gradient }}
                />
              )}
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
                  {creator.name}
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
              // Video cards always use the original YouTube thumbnail; an
              // uploaded location screenshot is only a fallback for non-YouTube URLs.
              const thumbnailUrl =
                getYouTubeThumbnailUrl(video.videoUrl) ||
                video.locations[0]?.screenshotUrl
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

      <SiteFooter />
    </div>
  )
}
