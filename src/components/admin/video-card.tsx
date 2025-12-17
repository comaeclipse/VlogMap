"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { extractYouTubeId } from "@/lib/youtube"
import type { VideoGroup } from "@/types/markers"

type VideoCardProps = {
  video: VideoGroup
  onEditVideo: (video: VideoGroup) => void
  onAddLocation: (video: VideoGroup) => void
  onDeleteLocation: (markerId: number) => void
}

export function VideoCard({ video, onEditVideo, onAddLocation, onDeleteLocation }: VideoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 text-left hover:bg-slate-800/30 transition-colors rounded-t-xl"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link
              href={`/edit/${extractYouTubeId(video.videoUrl) || ''}`}
              className="font-medium text-white truncate hover:text-blue-400 transition-colors block"
              onClick={(e) => e.stopPropagation()}
            >
              {video.title}
            </Link>
            <p className="text-sm text-slate-400 mt-1">
              {video.creator} · {video.locationCount} location{video.locationCount !== 1 ? 's' : ''}
            </p>
            {video.videoPublishedAt && (
              <p className="text-xs text-slate-500 mt-1">
                Published: {new Date(video.videoPublishedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                onAddLocation(video)
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Location
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation()
                onEditVideo(video)
              }}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Batch Edit
            </Button>
            <ChevronDown
              className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10 p-5 space-y-2">
          {video.locations.map((location, index) => (
            <div
              key={location.id}
              className="rounded-lg border border-white/5 bg-slate-800/50 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    Location {index + 1}
                    {location.locationId && (
                      <span className="ml-1 font-mono text-xs text-slate-500">
                        #{location.locationId}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                    {location.city && ` · ${location.city}`}
                  </p>
                  {location.description && (
                    <p className="text-xs text-slate-500 mt-1 truncate">{location.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDeleteLocation(location.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
