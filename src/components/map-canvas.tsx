"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import Link from "next/link"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import type { Marker as MarkerType } from "@/types/markers"
import { getYouTubeThumbnailUrl } from "@/lib/youtube"
import { getCreatorGradient } from "@/lib/gradients"

type Props = {
  markers: MarkerType[]
  onSelect?: (marker: MarkerType) => void
  focusMarker?: MarkerType | null
  autoFit?: boolean
}

const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
const attribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

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

    // Get the marker's pixel position
    const markerLatLng = L.latLng(marker.latitude, marker.longitude)
    const markerPoint = map.latLngToContainerPoint(markerLatLng)

    // Calculate center offset to account for popup (move marker down in viewport)
    const mapSize = map.getSize()
    const offsetY = mapSize.y * 0.25 // Offset by 25% of map height

    // Calculate the new center point
    const targetPoint = L.point(mapSize.x / 2, mapSize.y / 2 + offsetY)
    const targetLatLng = map.containerPointToLatLng(
      L.point(markerPoint.x - targetPoint.x + mapSize.x / 2, markerPoint.y - targetPoint.y + mapSize.y / 2)
    )

    // Fly to the adjusted position
    map.flyTo(targetLatLng, map.getZoom(), { animate: true, duration: 0.8 })
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
            <div className="min-w-[280px] text-sm">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-500 leading-tight">
                {marker.creator}
              </p>
              <p className="mb-1 font-semibold text-slate-900 leading-snug">{marker.title}</p>
              {/* Location info: city, district/state, and location name */}
              {(marker.city || marker.district || marker.locationName) && (
                <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-600">
                  {marker.city && <span>{marker.city}</span>}
                  {marker.city && marker.district && <span>·</span>}
                  {marker.district && <span>{marker.district}</span>}
                  {marker.locationName && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 font-medium">
                      {marker.locationName}
                    </span>
                  )}
                </div>
              )}
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
