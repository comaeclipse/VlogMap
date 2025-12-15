"use client"

import dynamic from "next/dynamic"
import type { Marker } from "@/types/markers"

const MapCanvas = dynamic(
  () => import("@/components/map-canvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-lg bg-slate-900">
        <p className="text-sm text-slate-400">Loading map...</p>
      </div>
    ),
  }
)

interface VideoMapSectionProps {
  markers: Marker[]
}

export function VideoMapSection({ markers }: VideoMapSectionProps) {
  if (markers.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-50">
        Filming Locations
      </h2>
      <div className="h-[300px] overflow-hidden rounded-lg border border-white/10">
        <MapCanvas markers={markers} autoFit={true} />
      </div>
    </div>
  )
}
