"use client"

import Link from "next/link"
import { MapPin, Clock, Landmark } from "lucide-react"
import type { Marker } from "@/types/markers"
import { Badge } from "@/components/ui/badge"

interface VideoTimelineProps {
  markers: Marker[]
  videoUrl: string
}

export function VideoTimeline({ markers, videoUrl }: VideoTimelineProps) {
  // Sort markers by timestamp
  const sortedMarkers = [...markers].sort((a, b) => {
    const timeA = timestampToSeconds(a.timestamp)
    const timeB = timestampToSeconds(b.timestamp)
    return timeA - timeB
  })

  // Filter out markers without timestamps for the timeline
  const timelineMarkers = sortedMarkers.filter((m) => m.timestamp)

  if (timelineMarkers.length === 0) {
    return null
  }

  return (
    <div className="border-t border-white/10 bg-slate-950/50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-400" />
          <h2 className="text-2xl font-semibold text-white">Video Timeline</h2>
          <span className="text-sm text-slate-400">
            {timelineMarkers.length} timestamped location{timelineMarkers.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="space-y-3">
          {timelineMarkers.map((marker, index) => (
            <div
              key={marker.id}
              className="group relative flex items-start gap-4 rounded-lg border border-white/10 bg-slate-900/60 p-4 transition-all hover:border-white/20 hover:bg-slate-900"
            >
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 ring-2 ring-blue-500/30">
                  <span className="text-sm font-semibold text-blue-400">
                    {index + 1}
                  </span>
                </div>
                {index < timelineMarkers.length - 1 && (
                  <div className="mt-2 h-full w-0.5 bg-gradient-to-b from-blue-500/30 to-transparent" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={createTimestampLink(videoUrl, marker.timestamp!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-lg font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {marker.timestamp}
                      </a>
                      {marker.locationType === 'city' && (
                        <Badge variant="secondary" className="text-xs">
                          City
                        </Badge>
                      )}
                      {marker.locationType === 'landmark' && (
                        <Badge variant="default" className="text-xs">
                          Landmark
                        </Badge>
                      )}
                    </div>
                    
                    {marker.locationName && (
                      <div className="mt-1 flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-amber-400" />
                        {marker.locationId ? (
                          <Link
                            href={`/location/${marker.locationId}`}
                            className="text-lg font-semibold text-white hover:text-amber-300 transition-colors"
                          >
                            {marker.locationName}
                          </Link>
                        ) : (
                          <h3 className="text-lg font-semibold text-white">
                            {marker.locationName}
                          </h3>
                        )}
                      </div>
                    )}

                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                      <MapPin className="h-3 w-3" />
                      {(() => {
                        const cityLinkId = marker.locationType === 'landmark' && marker.parentLocationId
                          ? marker.parentLocationId
                          : marker.locationId
                        const cityText = [marker.city, marker.country]
                          .filter(Boolean)
                          .join(", ") || "Location"

                        return cityLinkId ? (
                          <Link
                            href={`/location/${cityLinkId}`}
                            className="hover:text-slate-200 transition-colors"
                          >
                            {cityText}
                          </Link>
                        ) : (
                          <span>{cityText}</span>
                        )
                      })()}
                    </div>

                    {marker.description && (
                      <p className="mt-2 text-sm text-slate-300">
                        {marker.description}
                      </p>
                    )}

                    {marker.parentLocationName && (
                      <p className="mt-1 text-xs text-slate-500">
                        In: {marker.parentLocationName}
                      </p>
                    )}
                  </div>

                  {marker.screenshotUrl && (
                    <a
                      href={createTimestampLink(videoUrl, marker.timestamp!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <img
                        src={marker.screenshotUrl}
                        alt={marker.locationName || "Location"}
                        className="h-20 w-32 rounded-md object-cover border border-white/10 transition-all group-hover:ring-2 group-hover:ring-blue-500/50"
                      />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Helper function to convert timestamp to seconds
function timestampToSeconds(timestamp: string | null | undefined): number {
  if (!timestamp) return Infinity

  const parts = timestamp.split(":").map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return Infinity
}

// Helper function to create YouTube timestamp link
function createTimestampLink(videoUrl: string, timestamp: string): string {
  const seconds = timestampToSeconds(timestamp)
  if (seconds === Infinity) return videoUrl

  try {
    const url = new URL(videoUrl)
    if (url.hostname.includes("youtu.be")) {
      return `${videoUrl}?t=${Math.floor(seconds)}`
    } else {
      url.searchParams.set("t", Math.floor(seconds).toString())
      return url.toString()
    }
  } catch {
    return videoUrl
  }
}

