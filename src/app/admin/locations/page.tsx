"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, Pencil, Check, X, MapPin, Video, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/sonner"

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

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(async (res) => {
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || "Failed to load")
    }
    return res.json()
  })

export default function LocationsManagementPage() {
  const router = useRouter()
  const { data: authData, isLoading: authLoading } = useSWR<{
    authenticated: boolean
  }>("/api/auth/check", fetcher)

  const { data, error, isLoading, mutate } = useSWR<{
    locations: LocationWithStats[]
    totalCount: number
  }>("/api/locations", fetcher)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (!authLoading && authData && !authData.authenticated) {
      router.push("/login")
    }
  }, [authData, authLoading, router])

  const startEdit = (location: LocationWithStats) => {
    setEditingId(location.id)
    setEditValue(location.name || "")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue("")
  }

  const saveName = async (locationId: string) => {
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editValue.trim() || null }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Failed to update location name")
        return
      }

      toast.success("Location name updated")
      setEditingId(null)
      setEditValue("")
      await mutate()
    } catch (error) {
      toast.error("Failed to update location name")
      console.error(error)
    }
  }

  const filteredLocations = data?.locations.filter((location) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      location.id.toLowerCase().includes(query) ||
      location.name?.toLowerCase().includes(query) ||
      location.city?.toLowerCase().includes(query) ||
      location.district?.toLowerCase().includes(query) ||
      location.country?.toLowerCase().includes(query)
    )
  })

  if (authLoading || !authData?.authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Checking authentication...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Manage Locations</h1>
          </div>
          <span className="text-sm text-slate-400">
            {data?.totalCount || 0} total locations
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by ID, name, city, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-white/10 bg-slate-900/60"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-12 text-center">
            <p className="text-slate-400">Loading locations...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-12 text-center">
            <h2 className="mb-2 text-xl font-semibold text-red-300">
              Failed to load locations
            </h2>
            <p className="text-red-400">Please try again later</p>
          </div>
        ) : !filteredLocations || filteredLocations.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-12 text-center">
            <p className="text-slate-400">
              {searchQuery ? "No locations match your search" : "No locations found"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/60">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/10 bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Location ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Coordinates
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      City / District / Country
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Location Name
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Videos
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLocations.map((location) => (
                    <tr
                      key={location.id}
                      className="transition-colors hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/location/${location.id}`}
                          className="font-mono text-sm text-blue-400 hover:text-blue-300"
                        >
                          {location.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-400">
                          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {[location.city, location.district, location.country]
                            .filter(Boolean)
                            .join(", ") || (
                            <span className="text-slate-500">Unknown</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === location.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder="Enter location name..."
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveName(location.id)
                                if (e.key === "Escape") cancelEdit()
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => saveName(location.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className={location.name ? "text-sm" : "text-sm text-slate-500"}>
                              {location.name || "(Unnamed)"}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(location)}
                              className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-sm text-blue-400">
                          <Video className="h-3.5 w-3.5" />
                          <span>{location.videoCount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/location/${location.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                              <MapPin className="h-3 w-3" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

