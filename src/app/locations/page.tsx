"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Globe2, MapPin, Video } from "lucide-react"
import { Button } from "@/components/ui/button"

type LocationWithStats = {
  id: string
  latitude: number
  longitude: number
  city: string | null
  name: string | null
  createdAt: string
  markerCount: number
  videoCount: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function LocationsPage() {
  const { data, error, isLoading } = useSWR<{
    locations: LocationWithStats[]
    totalCount: number
  }>("/api/locations", fetcher)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Map
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-sky-200 ring-1 ring-white/10">
              <Globe2 className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">VlogMap</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">All Locations</h1>
          {isLoading ? (
            <p className="mt-2 text-slate-400">Loading locations...</p>
          ) : error ? (
            <p className="mt-2 text-red-400">Failed to load locations</p>
          ) : (
            <p className="mt-2 text-slate-400">
              Browse {data?.totalCount || 0} filming location
              {data?.totalCount !== 1 ? "s" : ""} from videos around the world
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-12 text-center">
            <p className="text-slate-400">Loading locations...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-12 text-center">
            <h2 className="text-xl font-semibold mb-2 text-red-300">
              Failed to load locations
            </h2>
            <p className="text-red-400">Please try again later</p>
          </div>
        ) : !data || data.locations.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-12 text-center">
            <MapPin className="mx-auto h-12 w-12 text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No locations yet</h2>
            <p className="text-slate-400">
              Locations will appear here once markers are added to the map
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.locations.map((location) => (
              <Link
                key={location.id}
                href={`/location/${location.id}`}
                className="group rounded-lg border border-white/10 bg-slate-900/60 p-5 transition-all hover:border-white/20 hover:bg-slate-900"
              >
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <MapPin className="h-3 w-3" />
                    <span className="font-mono">{location.id}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-50 group-hover:text-white">
                    {location.name || location.city || "Unknown Location"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5 text-blue-400" />
                    <span>{location.videoCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-pink-400" />
                    <span>{location.markerCount}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
