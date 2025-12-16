"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import Link from "next/link"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import type { Marker as MarkerType } from "@/types/markers"
import { getYouTubeThumbnailUrl } from "@/lib/youtube"

type Props = {
  markers: MarkerType[]
  onSelect?: (marker: MarkerType) => void
  focusMarker?: MarkerType | null
  autoFit?: boolean
}

const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
const attribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Generate a consistent gradient for each creator
function getCreatorGradient(creator: string): string {
  // Simple hash function to generate a number from the creator name
  let hash = 0
  for (let i = 0; i < creator.length; i++) {
    hash = creator.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Generate two distinct hues for the gradient
  const hue1 = Math.abs(hash % 360)
  const hue2 = (hue1 + 120) % 360 // 120 degrees apart for good contrast

  // Use vibrant colors with good saturation and lightness
  const color1 = `hsl(${hue1}, 75%, 60%)`
  const color2 = `hsl(${hue2}, 75%, 60%)`

  return `linear-gradient(135deg, ${color1}, ${color2})`
}

function createPinIcon(creator: string) {
  const gradient = getCreatorGradient(creator)
  return L.divIcon({
    className: "vlog-pin",
    html: `
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        background: ${gradient};
        border: 2px solid #0f172a;
        box-shadow: 0 8px 24px rgba(0,0,0,0.28);
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -8],
  })
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v')
    } else if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1)
    }
    return null
  } catch {
    return null
  }
}

function Recenter({ marker }: { marker?: MarkerType | null }) {
  const map = useMap()

  useEffect(() => {
    if (!marker) return
    map.panTo([marker.latitude, marker.longitude], { animate: true, duration: 0.8 })
  }, [map, marker])

  return null
}

function AutoFitBounds({ markers }: { markers: MarkerType[] }) {
  const map = useMap()

  useEffect(() => {
    if (markers.length === 0) return

    if (markers.length === 1) {
      // Single marker - center on it with a good zoom level
      map.setView([markers[0].latitude, markers[0].longitude], 13)
    } else {
      // Multiple markers - fit bounds
      const bounds = L.latLngBounds(
        markers.map((m) => [m.latitude, m.longitude])
      )
      map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 15,
      })
    }
  }, [map, markers])

  return null
}

export function MapCanvas({ markers, onSelect, focusMarker, autoFit }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string>("")

  const markerIcons = useMemo(() => {
    const icons = new Map<string, L.DivIcon>()
    markers.forEach((marker) => {
      if (!icons.has(marker.creator)) {
        icons.set(marker.creator, createPinIcon(marker.creator))
      }
    })
    return icons
  }, [markers])

  const handleImageClick = (imageUrl: string) => {
    setLightboxImage(imageUrl)
    setLightboxOpen(true)
  }

  return (
    <MapContainer
      className="h-full w-full"
      center={[12, 0]}
      zoom={2}
      minZoom={2}
      worldCopyJump
      scrollWheelZoom
      preferCanvas
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url={tileUrl} attribution={attribution} />

      {autoFit ? (
        <AutoFitBounds markers={markers} />
      ) : (
        <Recenter marker={focusMarker} />
      )}

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.latitude, marker.longitude]}
          icon={markerIcons.get(marker.creator) || createPinIcon(marker.creator)}
          eventHandlers={{
            click: () => onSelect?.(marker),
          }}
        >
          <Popup className="rounded-lg">
            <div className="text-sm">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-500 leading-tight">
                {marker.creator}
              </p>
              <p className="mb-1 font-semibold text-slate-900 leading-snug">{marker.title}</p>
              {marker.videoUrl && extractYouTubeVideoId(marker.videoUrl) ? (
                <Link
                  href={`/video/${extractYouTubeVideoId(marker.videoUrl)}`}
                  className="mb-2 inline-block text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  view more →
                </Link>
              ) : null}
              {(() => {
                const thumbnailUrl = marker.screenshotUrl || (marker.videoUrl ? getYouTubeThumbnailUrl(marker.videoUrl) : null)
                return thumbnailUrl ? (
                  <div className="py-2">
                    <img
                      src={thumbnailUrl}
                      alt={marker.title}
                      className="max-w-[280px] cursor-pointer rounded-md border border-slate-200 transition-opacity hover:opacity-80"
                      onClick={() => handleImageClick(thumbnailUrl)}
                      onError={(e) => {
                        // Fallback to hqdefault if maxresdefault fails
                        const target = e.target as HTMLImageElement
                        if (target.src.includes('maxresdefault')) {
                          target.src = target.src.replace('maxresdefault', 'hqdefault')
                        }
                      }}
                    />
                  </div>
                ) : null
              })()}
              {marker.description ? (
                <p className="text-slate-600">{marker.description}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                {marker.channelUrl ? (
                  <a
                    className="font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
                    href={marker.channelUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Channel
                  </a>
                ) : null}
                {marker.videoUrl ? (
                  <a
                    className="font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
                    href={marker.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Video
                  </a>
                ) : null}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={[{ src: lightboxImage }]}
        render={{
          buttonPrev: () => null,
          buttonNext: () => null,
        }}
      />
    </MapContainer>
  )
}
