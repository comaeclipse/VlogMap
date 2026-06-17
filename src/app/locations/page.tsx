import type { Metadata } from "next"
import Link from "next/link"
import { Globe2, MapPin, Video, ChevronRight, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getLocationsWithStats, type LocationWithStats } from "@/lib/locations-data"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Locations | VlogMap",
  description: "Browse all filming locations on VlogMap, organized by country, state, and city.",
}

type HierarchyNode = {
  locations: LocationWithStats[]
  cities?: Record<string, HierarchyNode>
  districts?: Record<string, HierarchyNode>
}
type Hierarchy = Record<string, HierarchyNode>

function buildHierarchy(locations: LocationWithStats[]): Hierarchy {
  const tree: Hierarchy = {}
  for (const location of locations) {
    const country = location.country || "Unknown Country"
    const isUSA = country === "United States" || country === "USA"
    const district = location.district || "Unknown District"
    const city = location.city || "Unknown City"

    if (!tree[country]) tree[country] = { locations: [], districts: {}, cities: {} }

    if (isUSA) {
      if (!tree[country].districts![district]) {
        tree[country].districts![district] = { locations: [], cities: {} }
      }
      if (!tree[country].districts![district].cities![city]) {
        tree[country].districts![district].cities![city] = { locations: [] }
      }
      tree[country].districts![district].cities![city].locations.push(location)
    } else {
      if (!tree[country].cities![city]) tree[country].cities![city] = { locations: [] }
      tree[country].cities![city].locations.push(location)
    }
  }
  return tree
}

function countCity(cityNode: HierarchyNode): number {
  return cityNode.locations.length
}
function countDistrict(districtNode: HierarchyNode): number {
  return Object.values(districtNode.cities || {}).reduce((n, c) => n + countCity(c), 0)
}
function countCountry(countryNode: HierarchyNode): number {
  let count = 0
  Object.values(countryNode.districts || {}).forEach((d) => (count += countDistrict(d)))
  Object.values(countryNode.cities || {}).forEach((c) => (count += countCity(c)))
  return count
}

function plural(n: number) {
  return n !== 1 ? "s" : ""
}

function LocationLink({ location }: { location: LocationWithStats }) {
  return (
    <Link
      href={`/location/${location.id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-slate-600/20 transition-colors group/link"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <MapPin className="h-4 w-4 text-pink-400 shrink-0" />
        <span className={location.name ? "text-slate-200 group-hover/link:text-white" : "text-slate-500"}>
          {location.name || `(Unnamed location ${location.id})`}
        </span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5 text-sm">
          <Video className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-slate-400">{location.videoCount}</span>
        </div>
        <span className="font-mono text-xs text-slate-600">{location.id}</span>
      </div>
    </Link>
  )
}

function CityDetails({ city, cityNode }: { city: string; cityNode: HierarchyNode }) {
  const count = countCity(cityNode)
  return (
    <details className="group/city rounded border border-white/5 bg-slate-700/20 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2 hover:bg-slate-600/20 transition-colors [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-open/city:rotate-90" />
        <span className="text-slate-300">{city}</span>
        <span className="text-sm text-slate-500">
          ({count} location{plural(count)})
        </span>
      </summary>
      <div className="border-t border-white/5 divide-y divide-white/5">
        {[...cityNode.locations]
          .sort((a, b) => b.videoCount - a.videoCount)
          .map((location) => (
            <LocationLink key={location.id} location={location} />
          ))}
      </div>
    </details>
  )
}

export default async function LocationsPage() {
  let locations: LocationWithStats[] = []
  let failed = false
  try {
    locations = await getLocationsWithStats()
  } catch (error) {
    console.error("Failed to load locations", error)
    failed = true
  }

  const hierarchy = buildHierarchy(locations)
  const countries = Object.entries(hierarchy).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sky-200 ring-1 ring-white/10">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Vlog map
                </p>
                <h1 className="text-lg font-semibold text-white">Explorer</h1>
              </div>
            </Link>
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
          <p className="mt-2 text-slate-400">
            Browse {locations.length} filming location{plural(locations.length)} organized by country
          </p>
        </div>

        {failed ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-12 text-center">
            <h2 className="text-xl font-semibold mb-2 text-red-300">Failed to load locations</h2>
            <p className="text-red-400">Please try again later</p>
          </div>
        ) : locations.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-12 text-center">
            <MapPin className="mx-auto h-12 w-12 text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No locations yet</h2>
            <p className="text-slate-400">
              Locations will appear here once markers are added to the map
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {countries.map(([country, countryNode]) => {
              const isUSA = country === "United States" || country === "USA"
              const count = countCountry(countryNode)
              return (
                <details key={country} className="group/country rounded-lg border border-white/10 bg-slate-900/60 overflow-hidden">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-open/country:rotate-90" />
                    <span className="text-lg font-semibold text-slate-50">{country}</span>
                    <span className="text-sm text-slate-400">
                      ({count} location{plural(count)})
                    </span>
                  </summary>

                  <div className="border-t border-white/5 px-4 py-2 space-y-2">
                    {isUSA
                      ? Object.entries(countryNode.districts || {})
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([district, districtNode]) => {
                            const dCount = countDistrict(districtNode)
                            return (
                              <details key={district} className="group/state rounded border border-white/5 bg-slate-800/30 overflow-hidden">
                                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-slate-700/30 transition-colors [&::-webkit-details-marker]:hidden">
                                  <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open/state:rotate-90" />
                                  <span className="font-medium text-slate-200">{district}</span>
                                  <span className="text-sm text-slate-500">
                                    ({dCount} location{plural(dCount)})
                                  </span>
                                </summary>
                                <div className="border-t border-white/5 px-4 py-2 space-y-2">
                                  {Object.entries(districtNode.cities || {})
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([city, cityNode]) => (
                                      <CityDetails key={city} city={city} cityNode={cityNode} />
                                    ))}
                                </div>
                              </details>
                            )
                          })
                      : Object.entries(countryNode.cities || {})
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([city, cityNode]) => (
                            <CityDetails key={city} city={city} cityNode={cityNode} />
                          ))}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
