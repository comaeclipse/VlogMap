"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Globe2, MapPin, Video, ChevronRight, ChevronDown, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

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

type HierarchyNode = {
  locations: LocationWithStats[]
  cities?: Record<string, HierarchyNode>
  districts?: Record<string, HierarchyNode>
}

type Hierarchy = Record<string, HierarchyNode>

export default function LocationsPage() {
  const { data, error, isLoading } = useSWR<{
    locations: LocationWithStats[]
    totalCount: number
  }>("/api/locations", fetcher)

  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set())
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set())
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())

  // Build hierarchy
  const hierarchy = useMemo(() => {
    if (!data?.locations) return {}

    const tree: Hierarchy = {}

    data.locations.forEach((location) => {
      const country = location.country || "Unknown Country"
      const district = location.district || "Unknown District"
      const city = location.city || "Unknown City"

      if (!tree[country]) {
        tree[country] = { locations: [], districts: {} }
      }

      if (!tree[country].districts![district]) {
        tree[country].districts![district] = { locations: [], cities: {} }
      }

      if (!tree[country].districts![district].cities![city]) {
        tree[country].districts![district].cities![city] = { locations: [] }
      }

      tree[country].districts![district].cities![city].locations.push(location)
    })

    return tree
  }, [data?.locations])

  const toggleCountry = (country: string) => {
    const newSet = new Set(expandedCountries)
    if (newSet.has(country)) {
      newSet.delete(country)
    } else {
      newSet.add(country)
    }
    setExpandedCountries(newSet)
  }

  const toggleDistrict = (key: string) => {
    const newSet = new Set(expandedDistricts)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedDistricts(newSet)
  }

  const toggleCity = (key: string) => {
    const newSet = new Set(expandedCities)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedCities(newSet)
  }

  const countLocationsInCountry = (countryNode: HierarchyNode): number => {
    let count = 0
    Object.values(countryNode.districts || {}).forEach((districtNode) => {
      Object.values(districtNode.cities || {}).forEach((cityNode) => {
        count += cityNode.locations.length
      })
    })
    return count
  }

  const countLocationsInDistrict = (districtNode: HierarchyNode): number => {
    let count = 0
    Object.values(districtNode.cities || {}).forEach((cityNode) => {
      count += cityNode.locations.length
    })
    return count
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
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
            <Link href="/locations">
              <Button variant="ghost" className="gap-2 text-slate-300 hover:text-white">
                <MapPin className="h-4 w-4" />
                Locations
              </Button>
            </Link>
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
              {data?.totalCount !== 1 ? "s" : ""} organized by country
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
          <div className="space-y-2">
            {Object.entries(hierarchy)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([country, countryNode]) => {
                const countryKey = country
                const isCountryExpanded = expandedCountries.has(countryKey)
                const locationCount = countLocationsInCountry(countryNode)

                return (
                  <div key={countryKey} className="rounded-lg border border-white/10 bg-slate-900/60 overflow-hidden">
                    <button
                      onClick={() => toggleCountry(countryKey)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-800/50 transition-colors"
                    >
                      {isCountryExpanded ? (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      )}
                      <span className="text-lg font-semibold text-slate-50">{country}</span>
                      <span className="text-sm text-slate-400">
                        ({locationCount} location{locationCount !== 1 ? "s" : ""})
                      </span>
                    </button>

                    {isCountryExpanded && (
                      <div className="border-t border-white/5 px-4 py-2 space-y-2">
                        {Object.entries(countryNode.districts || {})
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([district, districtNode]) => {
                            const districtKey = `${countryKey}-${district}`
                            const isDistrictExpanded = expandedDistricts.has(districtKey)
                            const districtLocationCount = countLocationsInDistrict(districtNode)

                            return (
                              <div key={districtKey} className="rounded border border-white/5 bg-slate-800/30 overflow-hidden">
                                <button
                                  onClick={() => toggleDistrict(districtKey)}
                                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-700/30 transition-colors"
                                >
                                  {isDistrictExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                  )}
                                  <span className="font-medium text-slate-200">{district}</span>
                                  <span className="text-sm text-slate-500">
                                    ({districtLocationCount} location{districtLocationCount !== 1 ? "s" : ""})
                                  </span>
                                </button>

                                {isDistrictExpanded && (
                                  <div className="border-t border-white/5 px-4 py-2 space-y-2">
                                    {Object.entries(districtNode.cities || {})
                                      .sort(([a], [b]) => a.localeCompare(b))
                                      .map(([city, cityNode]) => {
                                        const cityKey = `${districtKey}-${city}`
                                        const isCityExpanded = expandedCities.has(cityKey)
                                        const cityLocationCount = cityNode.locations.length

                                        return (
                                          <div key={cityKey} className="rounded border border-white/5 bg-slate-700/20 overflow-hidden">
                                            <button
                                              onClick={() => toggleCity(cityKey)}
                                              className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-600/20 transition-colors"
                                            >
                                              {isCityExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-slate-500" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4 text-slate-500" />
                                              )}
                                              <span className="text-slate-300">{city}</span>
                                              <span className="text-sm text-slate-500">
                                                ({cityLocationCount} location{cityLocationCount !== 1 ? "s" : ""})
                                              </span>
                                            </button>

                                            {isCityExpanded && (
                                              <div className="border-t border-white/5 divide-y divide-white/5">
                                                {cityNode.locations
                                                  .sort((a, b) => b.videoCount - a.videoCount)
                                                  .map((location) => (
                                                    <Link
                                                      key={location.id}
                                                      href={`/location/${location.id}`}
                                                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-600/20 transition-colors group"
                                                    >
                                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <MapPin className="h-4 w-4 text-pink-400 shrink-0" />
                                                        <span className={location.name ? "text-slate-200 group-hover:text-white" : "text-slate-500"}>
                                                          {location.name || `(Unnamed location ${location.id})`}
                                                        </span>
                                                      </div>
                                                      <div className="flex items-center gap-4 shrink-0">
                                                        <div className="flex items-center gap-1.5 text-sm">
                                                          <Video className="h-3.5 w-3.5 text-blue-400" />
                                                          <span className="text-slate-400">{location.videoCount}</span>
                                                        </div>
                                                        <span className="font-mono text-xs text-slate-600">
                                                          {location.id}
                                                        </span>
                                                      </div>
                                                    </Link>
                                                  ))}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </main>
    </div>
  )
}
