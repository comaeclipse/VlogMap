"use client"

import { useState } from "react"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import type { Marker } from "@/types/markers"
import { getYouTubeThumbnailUrl } from "@/lib/youtube"

interface PhotoGalleryProps {
  markers: Marker[]
}

export function PhotoGallery({ markers }: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Collect all images from markers (screenshots or YouTube thumbnails)
  const images = markers
    .map((marker, index) => ({
      src:
        marker.screenshotUrl ||
        (marker.videoUrl ? getYouTubeThumbnailUrl(marker.videoUrl) : null),
      alt: `${marker.title} - Location ${index + 1}`,
      description: marker.description,
    }))
    .filter((img) => img.src) as Array<{
    src: string
    alt: string
    description?: string | null
  }>

  if (images.length === 0) return null

  return (
    <section className="border-b border-white/10 bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-semibold text-slate-50">
          Photo Gallery
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
    </section>
  )
}
