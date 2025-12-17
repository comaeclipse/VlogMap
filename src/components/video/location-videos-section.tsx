import Link from "next/link"
import { MapPin, User } from "lucide-react"
import type { VideoGroup } from "@/types/markers"
import { extractYouTubeId, getYouTubeThumbnailUrl } from "@/lib/youtube"
import { VideoThumbnail } from "@/components/video-thumbnail"

interface LocationVideosSectionProps {
  locationId: string
  videos: VideoGroup[]
  currentVideoUrl: string
}

export function LocationVideosSection({
  locationId,
  videos,
  currentVideoUrl,
}: LocationVideosSectionProps) {
  // Filter out current video
  const otherVideos = videos.filter((v) => v.videoUrl !== currentVideoUrl)

  if (otherVideos.length === 0) {
    return null
  }

  return (
    <section className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-50">
              Other Videos at This Location
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {otherVideos.length} other video
              {otherVideos.length !== 1 ? "s" : ""} filmed at the same spot
              <span className="ml-2 font-mono text-xs text-blue-400">
                #{locationId}
              </span>
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {otherVideos.map((video) => {
            const videoId = extractYouTubeId(video.videoUrl)
            const thumbnailUrl =
              video.locations[0]?.screenshotUrl ||
              getYouTubeThumbnailUrl(video.videoUrl)

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
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{video.creator}</span>
                    </div>
                    {video.locationCount > 1 && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-pink-300" />
                        <span>{video.locationCount} locations</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
