import Link from "next/link"
import { MapPin, User } from "lucide-react"

import type { NearbyVideo } from "@/types/markers"
import { extractYouTubeId, getYouTubeThumbnailUrl } from "@/lib/youtube"

interface NearbyVideosSectionProps {
  videos: NearbyVideo[]
}

export function NearbyVideosSection({ videos }: NearbyVideosSectionProps) {
  if (videos.length === 0) {
    return (
      <section className="bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="mb-6 text-2xl font-semibold text-slate-50">
            Nearby Videos
          </h2>
          <p className="text-slate-400">
            No videos found within 100km of this location.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-semibold text-slate-50">
          Nearby Videos
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => {
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
                    <div className="absolute right-2 top-2 rounded-md bg-slate-950/90 px-2 py-1 text-xs font-medium text-slate-200">
                      {video.distanceKm === 0
                        ? "Same area"
                        : `${video.distanceKm} km away`}
                    </div>
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
    </section>
  )
}
