"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Globe2, MapPin, Video, ArrowUpDown, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type LocationWithStats = {
  id: string
  latitude: number
  longitude: number
  city: string | null
  district: string | null
  country: string | null
  name: string | null
  createdAt: string
  markerCount: number
  videoCount: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type SortOption = "most-videos" | "fewest-videos" | "a-z" | "z-a"
type GroupOption = "none" | "city" | "district" | "country" | "video-count"

export default function LocationsPage() {
  const { data, error, isLoading } = useSWR<{
    locations: LocationWithStats[]
    totalCount: number
  }>("/api/locations", fetcher)

  const [sortBy, setSortBy] = useState<SortOption>("most-videos")
  const [groupBy, setGroupBy] = useState<GroupOption>("none")

  // Sort locations
  const sortedLocations = useMemo(() => {
    if (!data?.locations) return []
    
    const locations = [...data.locations]
    
    switch (sortBy) {
      case "most-videos":
        return locations.sort((a, b) => b.videoCount - a.videoCount || b.markerCount - a.markerCount)
      case "fewest-videos":
        return locations.sort((a, b) => a.videoCount - b.videoCount || a.markerCount - b.markerCount)
      case "a-z":
        return locations.sort((a, b) => {
          const nameA = a.name || a.city || "Unknown"
          const nameB = b.name || b.city || "Unknown"
          return nameA.localeCompare(nameB)
        })
      case "z-a":
        return locations.sort((a, b) => {
          const nameA = a.name || a.city || "Unknown"
          const nameB = b.name || b.city || "Unknown"
          return nameB.localeCompare(nameA)
        })
      default:
        return locations
    }
  }, [data?.locations, sortBy])

  // Group locations
  const groupedLocations = useMemo(() => {
    if (groupBy === "none") {
      return { "All Locations": sortedLocations }
    }

    const groups: Record<string, LocationWithStats[]> = {}

    sortedLocations.forEach((location) => {
      let groupKey = "Unknown"

      switch (groupBy) {
        case "city":
          groupKey = location.city || "Unknown City"
          break
        case "district":
          groupKey = location.district || "Unknown District"
          break
        case "country":
          groupKey = location.country || "Unknown Country"
          break
        case "video-count":
          if (location.videoCount === 1) {
            groupKey = "1 video"
          } else if (location.videoCount >= 2 && location.videoCount <= 5) {
            groupKey = "2-5 videos"
          } else if (location.videoCount >= 6 && location.videoCount <= 10) {
            groupKey = "6-10 videos"
          } else {
            groupKey = "11+ videos"
          }
          break
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(location)
    })

    // Sort group keys
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (groupBy === "video-count") {
        // Custom sort for video count groups
        const order = ["11+ videos", "6-10 videos", "2-5 videos", "1 video"]
        return order.indexOf(a) - order.indexOf(b)
      }
      return a.localeCompare(b)
    })

    const sortedGroups: Record<string, LocationWithStats[]> = {}
    sortedGroupKeys.forEach((key) => {
      sortedGroups[key] = groups[key]
    })

    return sortedGroups
  }, [sortedLocations, groupBy])

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

        {/* Sorting and Grouping Controls */}
        {!isLoading && !error && data && data.locations.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-slate-400" />
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-[180px] border-white/10 bg-slate-900/60">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="most-videos">Most Videos</SelectItem>
                  <SelectItem value="fewest-videos">Fewest Videos</SelectItem>
                  <SelectItem value="a-z">A-Z</SelectItem>
                  <SelectItem value="z-a">Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-400" />
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupOption)}>
                <SelectTrigger className="w-[180px] border-white/10 bg-slate-900/60">
                  <SelectValue placeholder="Group by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="city">By City</SelectItem>
                  <SelectItem value="district">By District</SelectItem>
                  <SelectItem value="country">By Country</SelectItem>
                  <SelectItem value="video-count">By Video Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

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
          <div className="space-y-8">
            {Object.entries(groupedLocations).map(([groupName, locations]) => (
              <div key={groupName}>
                {groupBy !== "none" && (
                  <h2 className="text-2xl font-semibold mb-4 text-slate-200">
                    {groupName}
                    <span className="ml-2 text-sm font-normal text-slate-400">
                      ({locations.length} location{locations.length !== 1 ? "s" : ""})
                    </span>
                  </h2>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {locations.map((location) => (
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
                        {groupBy !== "city" && location.city && (
                          <p className="text-xs text-slate-400 mt-1">{location.city}</p>
                        )}
                        {groupBy !== "country" && location.country && (
                          <p className="text-xs text-slate-400 mt-1">{location.country}</p>
                        )}
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
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
