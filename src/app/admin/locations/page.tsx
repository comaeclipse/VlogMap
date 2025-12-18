"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import {
  ArrowLeft,
  Building2,
  Landmark,
  MapPin,
  Search,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
  Globe,
  Plus,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/sonner"
import type { Marker } from "@/types/markers"

type ViewMode = "city" | "orphans" | "unassigned"

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(async (res) => {
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || "Failed to load")
    }
    return res.json()
  })

export default function TaxonomyManagerPage() {
  const router = useRouter()
  const { data: authData, isLoading: authLoading } = useSWR<{
    authenticated: boolean
  }>("/api/auth/check", fetcher)

  const { data: markers, error, isLoading, mutate } = useSWR<Marker[]>(
    "/api/markers",
    fetcher
  )

  // State
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("city")
  const [selectedMarkerIds, setSelectedMarkerIds] = useState<Set<number>>(new Set())
  const [citySearch, setCitySearch] = useState("")
  const [landmarkSearch, setLandmarkSearch] = useState("")
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [updatingMarkerId, setUpdatingMarkerId] = useState<number | null>(null)
  const [isCreateCityOpen, setIsCreateCityOpen] = useState(false)
  const [newCityData, setNewCityData] = useState({
    name: "",
    country: "",
    district: "",
    isNewCountry: false,
    newCountryName: ""
  })


  // Derived data
  const cityMarkers = useMemo(
    () => markers?.filter((m) => m.type === "city") || [],
    [markers]
  )

  const landmarkMarkers = useMemo(
    () => markers?.filter((m) => m.type === "landmark") || [],
    [markers]
  )

  const unassignedMarkers = useMemo(
    () => markers?.filter((m) => !m.type) || [],
    [markers]
  )

  const orphanLandmarks = useMemo(
    () => landmarkMarkers.filter((m) => !m.parentCityId),
    [landmarkMarkers]
  )

  // Count children for each city
  const cityChildCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    landmarkMarkers.forEach((m) => {
      if (m.parentCityId) {
        counts[m.parentCityId] = (counts[m.parentCityId] || 0) + 1
      }
    })
    return counts
  }, [landmarkMarkers])

  // Get unique countries
  const countries = useMemo(() => {
    const unique = new Set(cityMarkers.map((m) => m.country).filter(Boolean))
    return Array.from(unique).sort() as string[]
  }, [cityMarkers])

  // Filter cities by search AND country
  const filteredCities = useMemo(() => {
    let filtered = cityMarkers

    // Filter by country if selected
    if (selectedCountry === "unassigned") {
      filtered = filtered.filter((m) => !m.country)
    } else if (selectedCountry) {
      filtered = filtered.filter((m) => m.country === selectedCountry)
    }

    if (!citySearch) return filtered
    const query = citySearch.toLowerCase()
    return filtered.filter(
      (m) =>
        m.city?.toLowerCase().includes(query) ||
        m.locationName?.toLowerCase().includes(query) ||
        m.creator?.toLowerCase().includes(query) ||
        m.country?.toLowerCase().includes(query)
    )
  }, [cityMarkers, citySearch, selectedCountry])

  // Get landmarks for right panel based on view mode
  const displayedMarkers = useMemo(() => {
    let list: Marker[] = []
    if (viewMode === "city" && selectedCityId) {
      list = landmarkMarkers.filter((m) => m.parentCityId === selectedCityId)
    } else if (viewMode === "orphans") {
      list = orphanLandmarks
    } else if (viewMode === "unassigned") {
      list = unassignedMarkers
    }

    if (!landmarkSearch) return list
    const query = landmarkSearch.toLowerCase()
    return list.filter(
      (m) =>
        m.city?.toLowerCase().includes(query) ||
        m.locationName?.toLowerCase().includes(query) ||
        m.title?.toLowerCase().includes(query) ||
        m.creator?.toLowerCase().includes(query)
    )
  }, [viewMode, selectedCityId, landmarkMarkers, orphanLandmarks, unassignedMarkers, landmarkSearch])

  // Selected city object
  const selectedCity = useMemo(
    () => cityMarkers.find((c) => c.id === selectedCityId),
    [cityMarkers, selectedCityId]
  )

  // Auth redirect
  useEffect(() => {
    if (!authLoading && authData && !authData.authenticated) {
      router.push("/login")
    }
  }, [authData, authLoading, router])

  // Clear selection when view changes
  useEffect(() => {
    setSelectedMarkerIds(new Set())
    setLandmarkSearch("")
  }, [viewMode, selectedCityId])

  // Handlers
  const selectCity = (cityId: number) => {
    setSelectedCityId(cityId)
    setViewMode("city")
  }

  const toggleMarkerSelection = (markerId: number) => {
    setSelectedMarkerIds((prev) => {
      const next = new Set(prev)
      if (next.has(markerId)) {
        next.delete(markerId)
      } else {
        next.add(markerId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedMarkerIds(new Set(displayedMarkers.map((m) => m.id)))
  }

  const deselectAll = () => {
    setSelectedMarkerIds(new Set())
  }

  // Update single marker
  const updateMarker = async (
    markerId: number,
    updates: { type?: string | null; parentCityId?: number | null }
  ) => {
    setUpdatingMarkerId(markerId)
    try {
      const res = await fetch(`/api/markers/${markerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Failed to update marker")
        return
      }

      toast.success("Marker updated")
      await mutate()
    } catch (error) {
      toast.error("Failed to update marker")
      console.error(error)
    } finally {
      setUpdatingMarkerId(null)
    }
  }

  // Bulk update markers
  const bulkUpdate = async (updates: {
    type?: string | null
    parentCityId?: number | null
  }) => {
    if (selectedMarkerIds.size === 0) return

    setBulkActionLoading(true)
    try {
      const res = await fetch("/api/markers/bulk-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          markerIds: Array.from(selectedMarkerIds),
          updates,
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Failed to update markers")
        return
      }

      const result = await res.json()
      toast.success(`Updated ${result.updatedCount} marker(s)`)
      setSelectedMarkerIds(new Set())
      await mutate()
    } catch (error) {
      toast.error("Failed to update markers")
      console.error(error)
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Create city
  const createCity = async () => {
    if (!newCityData.name) {
      toast.error("City name is required")
      return
    }

    const countryToUse = newCityData.isNewCountry
      ? newCityData.newCountryName
      : newCityData.country

    if (newCityData.isNewCountry && !newCityData.newCountryName) {
      toast.error("Country name is required")
      return
    }

    try {
      const res = await fetch("/api/markers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newCityData.name,
          city: newCityData.name, // Usually same as title for cities
          locationName: newCityData.name,
          country: countryToUse || null,
          district: newCityData.district || null,
          type: "city",
          latitude: 0, // Placeholder, usually needed but for taxonomy maybe optional? 
          // Valid schema requires numbers. We should probably ask for lat/long or default to 0.
          // The schema in route.ts inserts them. Let's assume 0 is fine for "abstract" cities,
          // or we should add lat/long inputs. For now default to 0.
          longitude: 0,
          creator: authData?.authenticated ? "Admin" : "System", // Or fetch user name
          description: "Created via Taxonomy Manager"
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Failed to create city")
        return
      }

      toast.success("City created")
      setIsCreateCityOpen(false)
      setNewCityData({
        name: "",
        country: "",
        district: "",
        isNewCountry: false,
        newCountryName: ""
      })

      // If we created a new country or assigned one, select it
      if (countryToUse) {
        setSelectedCountry(countryToUse)
      }

      await mutate()
    } catch (error) {
      toast.error("Failed to create city")
      console.error(error)
    }
  }

  // Get panel title based on view mode
  const getPanelTitle = () => {
    if (viewMode === "city" && selectedCity) {
      return `Landmarks in: ${selectedCity.city || selectedCity.locationName || "Unknown City"}`
    }
    if (viewMode === "orphans") {
      return "Orphan Landmarks (No Parent City)"
    }
    if (viewMode === "unassigned") {
      return "Unassigned Markers (No Type)"
    }
    return "Select a City"
  }

  if (authLoading || !authData?.authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Checking authentication...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Taxonomy Manager</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-blue-400" />
              {cityMarkers.length} cities
            </span>
            <span className="flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-amber-400" />
              {landmarkMarkers.length} landmarks
            </span>
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-slate-500" />
              {unassignedMarkers.length} unassigned
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <h2 className="mb-2 text-xl font-semibold text-red-300">
                Failed to load markers
              </h2>
              <p className="text-red-400">Please try again later</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex h-full">
              {/* Column 1: Countries */}
              <div className="flex w-64 flex-col border-r border-white/10 bg-slate-900/30">
                <div className="flex items-center justify-between border-b border-white/10 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Countries
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <button
                    onClick={() => {
                      setSelectedCountry(null)
                      setSelectedCityId(null)
                    }}
                    className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedCountry === null
                      ? "bg-blue-600/20 text-blue-400"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      }`}
                  >
                    All Countries
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCountry("unassigned")
                      setSelectedCityId(null)
                    }}
                    className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedCountry === "unassigned"
                      ? "bg-blue-600/20 text-blue-400"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      }`}
                  >
                    Unassigned
                  </button>
                  <div className="my-2 h-px bg-white/5" />
                  {countries.map((country) => (
                    <button
                      key={country}
                      onClick={() => {
                        setSelectedCountry(country)
                        setSelectedCityId(null)
                      }}
                      className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedCountry === country
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{country}</span>
                        <ChevronRight className={`h-3 w-3 ${selectedCountry === country ? "opacity-100" : "opacity-0"}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 2: Cities */}
              <div className="flex w-64 flex-col border-r border-white/10">
                {/* City search */}
                <div className="border-b border-white/10 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Cities ({filteredCities.length})
                    </h3>
                    <Dialog open={isCreateCityOpen} onOpenChange={setIsCreateCityOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="border-white/10 bg-slate-900 text-slate-50">
                        <DialogHeader>
                          <DialogTitle>Add New City</DialogTitle>
                          <DialogDescription>
                            Create a new city marker to group landmarks.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="name">City Name</Label>
                            <Input
                              id="name"
                              value={newCityData.name}
                              onChange={(e) => setNewCityData(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g. Paris"
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="country">Country</Label>
                            <div className="flex flex-col gap-2">
                              {!newCityData.isNewCountry ? (
                                <Select
                                  value={newCityData.country}
                                  onValueChange={(val) => {
                                    if (val === "new_country_option") {
                                      setNewCityData(prev => ({ ...prev, isNewCountry: true, country: "" }))
                                    } else {
                                      setNewCityData(prev => ({ ...prev, country: val }))
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select country..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="new_country_option" className="text-blue-400 font-medium">
                                      + Create New Country
                                    </SelectItem>
                                    {countries.map(c => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    value={newCityData.newCountryName}
                                    onChange={(e) => setNewCityData(prev => ({ ...prev, newCountryName: e.target.value }))}
                                    placeholder="Enter new country name"
                                    className="flex-1"
                                  />
                                  <Button
                                    variant="ghost"
                                    onClick={() => setNewCityData(prev => ({ ...prev, isNewCountry: false }))}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="district">District (Optional)</Label>
                            <Input
                              id="district"
                              value={newCityData.district}
                              onChange={(e) => setNewCityData(prev => ({ ...prev, district: e.target.value }))}
                              placeholder="e.g. Île-de-France"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setIsCreateCityOpen(false)}>Cancel</Button>
                          <Button onClick={createCity}>Create City</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Filter cities..."
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      className="pl-10 border-white/10 bg-slate-900/60 h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Cities list */}
                <div className="flex-1 overflow-y-auto bg-slate-950/50">
                  <div className="p-2">
                    <div className="space-y-1">
                      {filteredCities.map((city) => (
                        <button
                          key={city.id}
                          onClick={() => selectCity(city.id)}
                          className={`w-full rounded-lg p-3 text-left transition-colors ${viewMode === "city" && selectedCityId === city.id
                            ? "bg-blue-600/20 ring-1 ring-blue-500/50"
                            : "hover:bg-slate-800/50"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 flex-shrink-0 text-blue-400" />
                                <span className="truncate font-medium">
                                  {city.city || city.locationName || "Unknown"}
                                </span>
                              </div>
                              {city.country && (
                                <p className="ml-6 truncate text-xs text-slate-500">
                                  {city.country}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <span>{cityChildCounts[city.id] || 0}</span>
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </div>
                        </button>
                      ))}
                      {filteredCities.length === 0 && (
                        <p className="px-2 py-4 text-center text-sm text-slate-500">
                          No cities found
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Special views */}
                  <div className="mt-auto border-t border-white/10 p-2">
                    {/* ... same special views but smaller? or leave as is */}
                    {/* Keep them at bottom of column 2 for now */}
                    <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Special Views
                    </h3>
                    <div className="space-y-1">
                      {/* ... buttons ... */}
                      <button
                        onClick={() => {
                          setViewMode("orphans")
                          setSelectedCityId(null)
                          setSelectedCountry(null)
                        }}
                        className={`w-full rounded-lg p-3 text-left transition-colors ${viewMode === "orphans"
                          ? "bg-amber-600/20 ring-1 ring-amber-500/50"
                          : "hover:bg-slate-800/50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Landmark className="h-4 w-4 text-amber-400" />
                            <span className="font-medium">Orphan</span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {orphanLandmarks.length}
                          </span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setViewMode("unassigned")
                          setSelectedCityId(null)
                          setSelectedCountry(null)
                        }}
                        className={`w-full rounded-lg p-3 text-left transition-colors ${viewMode === "unassigned"
                          ? "bg-slate-600/20 ring-1 ring-slate-500/50"
                          : "hover:bg-slate-800/50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-slate-400" />
                            <span className="font-medium">Unassigned</span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {unassignedMarkers.length}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel: Landmarks */}
              <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
                {/* Panel header */}
                <div className="border-b border-white/10 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold">{getPanelTitle()}</h2>
                    {displayedMarkers.length > 0 && (
                      <span className="text-sm text-slate-400">
                        {displayedMarkers.length} marker(s)
                      </span>
                    )}
                  </div>

                  {/* Search and bulk actions */}
                  {(viewMode !== "city" || selectedCityId) && displayedMarkers.length > 0 && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Search markers..."
                          value={landmarkSearch}
                          onChange={(e) => setLandmarkSearch(e.target.value)}
                          className="pl-10 border-white/10 bg-slate-900/60 h-9 text-sm"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectedMarkerIds.size === displayedMarkers.length ? deselectAll : selectAll}
                        className="h-9"
                      >
                        {selectedMarkerIds.size === displayedMarkers.length ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                  )}

                  {/* Bulk actions toolbar */}
                  {selectedMarkerIds.size > 0 && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg bg-blue-600/10 p-3 ring-1 ring-blue-500/30">
                      <span className="text-sm font-medium">
                        {selectedMarkerIds.size} selected
                      </span>
                      <div className="h-4 w-px bg-white/20" />

                      {/* Assign to city */}
                      <Select
                        onValueChange={(value) => bulkUpdate({ parentCityId: parseInt(value) })}
                        disabled={bulkActionLoading}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder="Assign to city..." />
                        </SelectTrigger>
                        <SelectContent>
                          {cityMarkers.map((city) => (
                            <SelectItem key={city.id} value={city.id.toString()}>
                              {city.city || city.locationName || "Unknown"} ({city.creator})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Set type */}
                      <Select
                        onValueChange={(value) => bulkUpdate({ type: value === "none" ? null : value })}
                        disabled={bulkActionLoading}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue placeholder="Set type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="city">City</SelectItem>
                          <SelectItem value="landmark">Landmark</SelectItem>
                          <SelectItem value="none">Unspecified</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Remove from city */}
                      {viewMode === "city" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => bulkUpdate({ parentCityId: null })}
                          disabled={bulkActionLoading}
                          className="h-8 text-xs"
                        >
                          Remove from City
                        </Button>
                      )}

                      {bulkActionLoading && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      )}
                    </div>
                  )}
                </div>

                {/* Markers list */}
                <div className="flex-1 overflow-y-auto p-4">
                  {viewMode === "city" && !selectedCityId ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <Building2 className="mx-auto h-12 w-12 text-slate-600" />
                        <p className="mt-4 text-slate-400">
                          Select a city from the middle panel to view its landmarks
                        </p>
                      </div>
                    </div>
                  ) : displayedMarkers.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <MapPin className="mx-auto h-12 w-12 text-slate-600" />
                        <p className="mt-4 text-slate-400">
                          {landmarkSearch ? "No markers match your search" : "No markers in this view"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {displayedMarkers.map((marker) => (
                        <div
                          key={marker.id}
                          className={`rounded-lg border bg-slate-900/60 p-4 transition-colors ${selectedMarkerIds.has(marker.id)
                            ? "border-blue-500/50 bg-blue-600/10"
                            : "border-white/10 hover:border-white/20"
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <Checkbox
                              checked={selectedMarkerIds.has(marker.id)}
                              onCheckedChange={() => toggleMarkerSelection(marker.id)}
                              className="mt-1"
                            />

                            {/* Marker info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {marker.type === "city" ? (
                                  <Building2 className="h-4 w-4 text-blue-400" />
                                ) : marker.type === "landmark" ? (
                                  <Landmark className="h-4 w-4 text-amber-400" />
                                ) : (
                                  <MapPin className="h-4 w-4 text-slate-400" />
                                )}
                                <span className="font-medium">
                                  {marker.locationName || marker.city || "Unnamed"}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-400">
                                {marker.creator} &bull; {marker.title}
                              </p>
                              <p className="mt-0.5 font-mono text-xs text-slate-500">
                                {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
                              </p>
                            </div>

                            {/* Individual actions */}
                            <div className="flex items-center gap-2">
                              {updatingMarkerId === marker.id && (
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              )}

                              {/* Type selector */}
                              <Select
                                value={marker.type || "none"}
                                onValueChange={(value) =>
                                  updateMarker(marker.id, { type: value === "none" ? null : value })
                                }
                                disabled={updatingMarkerId === marker.id}
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="city">City</SelectItem>
                                  <SelectItem value="landmark">Landmark</SelectItem>
                                  <SelectItem value="none">Unspecified</SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Parent city selector (only for landmarks) */}
                              {marker.type === "landmark" && (
                                <Select
                                  value={marker.parentCityId?.toString() || "none"}
                                  onValueChange={(value) =>
                                    updateMarker(marker.id, {
                                      parentCityId: value === "none" ? null : parseInt(value),
                                    })
                                  }
                                  disabled={updatingMarkerId === marker.id}
                                >
                                  <SelectTrigger className="h-8 w-48 text-xs">
                                    <SelectValue placeholder="No parent city" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No parent city</SelectItem>
                                    {cityMarkers.map((city) => (
                                      <SelectItem key={city.id} value={city.id.toString()}>
                                        {city.city || city.locationName || "Unknown"} ({city.creator})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
