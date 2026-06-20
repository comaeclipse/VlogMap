"use client"

import { useState } from "react"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import type { Marker } from "@/types/markers"
import { getYouTubeThumbnailUrl } from "@/lib/youtube"
import { getMarkerLocationLabel } from "@/lib/markers"

interface PhotoGalleryProps {
  markers: Marker[]
  // Server-verified YouTube thumbnail URL (probed to a tier that actually
  // exists). Preferred over the maxresdefault guess so we don't rely on the
  // client onError fallback firing.
  youtubeThumbnailUrl?: string | null
}

export function PhotoGallery({ markers, youtubeThumbnailUrl }: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Collect all unique images from markers
  const images: Array<{
    src: string
    alt: string
    description?: string | null
  }> = []
  
  const seenUrls = new Set<string>()

  // Always show the YouTube thumbnail first, even when screenshots exist.
  // Prefer the server-verified URL; fall back to the maxresdefault guess.
  if (markers.length > 0 && markers[0].videoUrl) {
    const thumbnailUrl =
      youtubeThumbnailUrl ?? getYouTubeThumbnailUrl(markers[0].videoUrl)
    if (thumbnailUrl && !seenUrls.has(thumbnailUrl)) {
      seenUrls.add(thumbnailUrl)
      images.push({
        src: thumbnailUrl,
        alt: markers[0].title,
        description: null,
      })
    }
  }

  // Add screenshots from markers
  markers.forEach((marker) => {
    if (marker.screenshotUrl && !seenUrls.has(marker.screenshotUrl)) {
      seenUrls.add(marker.screenshotUrl)
      images.push({
        src: marker.screenshotUrl,
        alt: getMarkerLocationLabel(marker),
        description: marker.description,
      })
    }
  })

  if (images.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-50">Photo Gallery</h2>

      <div className="grid gap-3 grid-cols-2">
        {images.map((image, idx) => (
            <button
              key={idx}
              onClick={() => {
                setLightboxIndex(idx)
                setLightboxOpen(true)
              }}
              className="group relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-slate-900 transition-transform hover:scale-[1.02]"
            >
              <img
                src={image.src}
                alt={image.alt}
                className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (target.src.includes("maxresdefault")) {
                    target.src = target.src.replace("maxresdefault", "hqdefault")
                  }
                }}
              />
              {image.description && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/90 to-transparent p-3 text-left text-xs text-slate-200 opacity-0 transition-opacity group-hover:opacity-100">
                  {image.description}
                </div>
              )}
            </button>
          ))}
        </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={images.map((img) => ({ src: img.src }))}
      />
    </div>
  )
}
