import Link from "next/link"
import { Calendar, ExternalLink, MapPin, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Marker } from "@/types/markers"

interface VideoHeaderProps {
  markers: Marker[]
  videoId: string
}

export function VideoHeader({ markers, videoId }: VideoHeaderProps) {
  const marker = markers[0]
  if (!marker) return null

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  const formattedDate = marker.videoPublishedAt
    ? new Date(marker.videoPublishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null

  return (
    <div className="border-b border-white/10 bg-slate-900/60">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-slate-50 md:text-4xl">
            {marker.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <Link
              href={`/creator/${encodeURIComponent(marker.creator)}`}
              className="flex items-center gap-2 transition-colors hover:text-slate-200"
            >
              <User className="h-4 w-4" />
              <span className="font-medium">{marker.creator}</span>
            </Link>

            {formattedDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formattedDate}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-pink-300" />
              <span>
                {markers.length} location{markers.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Watch on YouTube
              </a>
            </Button>

            {marker.channelUrl && (
              <Button variant="secondary" asChild>
                <a
                  href={marker.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  <User className="h-4 w-4" />
                  Visit Channel
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
