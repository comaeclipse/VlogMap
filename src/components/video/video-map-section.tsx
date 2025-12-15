"use client"

import dynamic from "next/dynamic"
import type { Marker } from "@/types/markers"

const MapCanvas = dynamic(
  () => import("@/components/map-canvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-900">
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
    <section className="border-b border-white/10 bg-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="mb-4 text-2xl font-semibold text-slate-50">
          Filming Locations
        </h2>
      </div>
      <div className="h-[300px] md:h-[500px]">
        <MapCanvas markers={markers} />
      </div>
    </section>
  )
}
