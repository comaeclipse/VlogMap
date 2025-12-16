"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useMemo, useState } from "react"
import useSWR from "swr"
import { AlertCircle, Globe2, MapPin, ShieldHalf, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  },
)

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || "Failed to load markers")
    }
    return res.json()
  })

export default function Home() {
  const { data, error, isLoading } = useSWR<Marker[]>("/api/markers", fetcher, {
    refreshInterval: 15000,
  })
  const [selected, setSelected] = useState<Marker | null>(null)
  const [selectedCreator, setSelectedCreator] = useState<string>("all")

  const creators = useMemo(() => {
    if (!data) return []
    const uniqueCreators = Array.from(new Set(data.map((m) => m.creator).filter(Boolean)))
    return uniqueCreators.sort((a, b) => a.localeCompare(b))
  }, [data])

  const filteredMarkers = useMemo(() => {
    if (!data) return []
    if (selectedCreator === "all") return data
    return data.filter((marker) => marker.creator === selectedCreator)
  }, [data, selectedCreator])

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sky-200 ring-1 ring-white/10">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Vlog map
                </p>
                <h1 className="text-lg font-semibold text-white">Explorer</h1>
              </div>
            </div>
            <Link href="/creators">
              <Button variant="ghost" className="gap-2 text-slate-300 hover:text-white">
                <Users className="h-4 w-4" />
                Creators
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <Select value={selectedCreator} onValueChange={setSelectedCreator}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="All Creators" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="all">All Creators</SelectItem>
                {creators.map((creator) => (
                  <SelectItem key={creator} value={creator}>
                    {creator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-pink-300" />
              {isLoading ? "Loading..." : `${filteredMarkers.length} location${filteredMarkers.length !== 1 ? 's' : ''}`}
            </span>
            {error ? (
              <span className="flex items-center gap-1 text-amber-200">
                <AlertCircle className="h-4 w-4" /> API error
              </span>
            ) : null}
            <Link href="/admin">
              <Button variant="secondary" className="gap-2">
                <ShieldHalf className="h-4 w-4" />
                Manage
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="absolute inset-0">
          <MapCanvas
            markers={filteredMarkers}
            onSelect={setSelected}
            focusMarker={selected}
          />
        </div>
      </main>
    </div>
  )
}
