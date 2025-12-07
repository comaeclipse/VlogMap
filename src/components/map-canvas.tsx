"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"

import type { Marker as MarkerType } from "@/types/markers"

type Props = {
  markers: MarkerType[]
  onSelect?: (marker: MarkerType) => void
  focusMarker?: MarkerType | null
}

const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const attribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function Recenter({ marker }: { marker?: MarkerType | null }) {
  const map = useMap()

  useEffect(() => {
    if (!marker) return
    map.flyTo([marker.latitude, marker.longitude], 5, { duration: 0.8 })
  }, [map, marker])

  return null
}

export function MapCanvas({ markers, onSelect, focusMarker }: Props) {
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: "vlog-pin",
        html: `
          <div style="
            width: 14px;
            height: 14px;
            border-radius: 9999px;
            background: linear-gradient(135deg, #d946ef, #22d3ee);
            border: 2px solid #0f172a;
            box-shadow: 0 8px 24px rgba(0,0,0,0.28);
          "></div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -8],
      }),
    [],
  )

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

      <Recenter marker={focusMarker} />

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.latitude, marker.longitude]}
          icon={pinIcon}
          eventHandlers={{
            click: () => onSelect?.(marker),
          }}
        >
          <Popup className="rounded-lg">
            <div className="space-y-1 text-sm">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                {marker.creator}
              </p>
              <p className="font-semibold text-slate-900">{marker.title}</p>
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
    </MapContainer>
  )
}
