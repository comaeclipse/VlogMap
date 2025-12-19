"use client"

import { useEffect, useState, useMemo, useRef } from "react"
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
  Edit2,
  Trash2,
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

// Location type from our API
type Location = {
  id: string
  name: string | null
  type: string | null
  latitude: number
  longitude: number
  city: string | null
  district: string | null
  country: string | null
  parentLocationId: string | null
  parentLocationName: string | null
  createdAt: string
  markerCount: number
  videoCount: number
  landmarkCount: number
}

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

  // Fetch locations instead of markers
  const { data: locationsData, error: locationsError, isLoading: locationsLoading, mutate: mutateLocations } = useSWR<{
    locations: Location[]
    totalCount: number
  }>("/api/locations", fetcher)

  // Also fetch markers for "unassigned" view (markers without location_id)
  const { data: markers, error: markersError, isLoading: markersLoading, mutate: mutateMarkers } = useSWR<Marker[]>(
    "/api/markers",
    fetcher
  )

  const locations = locationsData?.locations || []
  const isLoading = locationsLoading || markersLoading
  const error = locationsError || markersError

  // Mutate both when needed
  const mutate = async () => {
    await Promise.all([mutateLocations(), mutateMarkers()])
  }

  // State
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null) // Changed to string (location id)
  const [viewMode, setViewMode] = useState<ViewMode>("city")
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set()) // Changed to string
  const [citySearch, setCitySearch] = useState("")
  const [landmarkSearch, setLandmarkSearch] = useState("")
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [updatingLocationId, setUpdatingLocationId] = useState<string | null>(null)
  const [isCreateCityOpen, setIsCreateCityOpen] = useState(false)
  const [isCreateLandmarkOpen, setIsCreateLandmarkOpen] = useState(false)
  const [isEditLocationOpen, setIsEditLocationOpen] = useState(false)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [newCityData, setNewCityData] = useState({
    name: "",
    country: "",
    district: "",
    isNewCountry: false,
    newCountryName: ""
  })
  const [newLandmarkData, setNewLandmarkData] = useState({
    name: "",
    parentCityId: "none",
  })
  const [editLocationData, setEditLocationData] = useState({
    name: "",
    parentCityId: "none",
    country: "",
    district: "",
  })

  // Refs for scrollable containers
  const countriesScrollRef = useRef<HTMLDivElement>(null)
  const citiesScrollRef = useRef<HTMLDivElement>(null)

  // Derived data - now using locations
  const cityLocations = useMemo(
    () => locations.filter((l) => l.type === "city"),
    [locations]
  )

  const landmarkLocations = useMemo(
    () => locations.filter((l) => l.type === "landmark"),
    [locations]
  )

  // Markers without location_id are unassigned
  const unassignedMarkers = useMemo(
    () => markers?.filter((m) => !m.locationId) || [],
    [markers]
  )

  // Landmarks without parent city
  const orphanLandmarks = useMemo(
    () => landmarkLocations.filter((l) => !l.parentLocationId),
    [landmarkLocations]
  )

  // Get unique countries from city locations
  const countries = useMemo(() => {
    const unique = new Set(cityLocations.map((l) => l.country).filter(Boolean))
    return Array.from(unique).sort() as string[]
  }, [cityLocations])

  // Filter cities by search AND country
  const filteredCities = useMemo(() => {
    let filtered = cityLocations

    // Filter by country if selected
    if (selectedCountry === "unassigned") {
      filtered = filtered.filter((l) => !l.country)
    } else if (selectedCountry) {
      filtered = filtered.filter((l) => l.country === selectedCountry)
    }

    if (!citySearch) return filtered
    const query = citySearch.toLowerCase()
    return filtered.filter(
      (l) =>
        l.name?.toLowerCase().includes(query) ||
        l.city?.toLowerCase().includes(query) ||
        l.country?.toLowerCase().includes(query)
    )
  }, [cityLocations, citySearch, selectedCountry])

  // Get landmarks for right panel based on view mode
  const displayedLocations = useMemo(() => {
    let list: Location[] = []
    if (viewMode === "city" && selectedCityId) {
      list = landmarkLocations.filter((l) => l.parentLocationId === selectedCityId)
    } else if (viewMode === "orphans") {
      list = orphanLandmarks
    }

    if (!landmarkSearch) return list
    const query = landmarkSearch.toLowerCase()
    return list.filter(
      (l) =>
        l.name?.toLowerCase().includes(query) ||
        l.city?.toLowerCase().includes(query)
    )
  }, [viewMode, selectedCityId, landmarkLocations, orphanLandmarks, landmarkSearch])

  // Selected city object
  const selectedCity = useMemo(
    () => cityLocations.find((c) => c.id === selectedCityId),
    [cityLocations, selectedCityId]
  )

  // Auth redirect
  useEffect(() => {
    if (!authLoading && authData && !authData.authenticated) {
      router.push("/login")
    }
  }, [authData, authLoading, router])

  // Clear selection when view changes
  useEffect(() => {
    setSelectedLocationIds(new Set())
    setLandmarkSearch("")
  }, [viewMode, selectedCityId])

  // Handlers
  const selectCity = (cityId: string) => {
    setSelectedCityId(cityId)
    setViewMode("city")
  }

  const toggleLocationSelection = (locationId: string) => {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev)
      if (next.has(locationId)) {
        next.delete(locationId)
      } else {
        next.add(locationId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedLocationIds(new Set(displayedLocations.map((m) => m.id)))
  }

  const deselectAll = () => {
    setSelectedLocationIds(new Set())
  }

  // Update single location
  const updateLocation = async (
    locationId: string,
    updates: { name?: string; parentLocationId?: string | null }
  ) => {
    setUpdatingLocationId(locationId)
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Failed to update location")
        return
      }

      toast.success("Location updated")
      await mutate()
    } catch (error) {
      toast.error("Failed to update location")
      console.error(error)
    } finally {
      setUpdatingLocationId(null)
    }
  }

  useEffect(() => {
    if (!isCreateLandmarkOpen) return

    if (selectedCity) {
      setNewLandmarkData((prev) => ({
        ...prev,
        parentCityId: selectedCity.id,
      }))
    }
  }, [isCreateLandmarkOpen, selectedCity])

  const openEditLocation = (location: Location) => {
    setEditingLocationId(location.id)
    setEditLocationData({
      name: location.name ?? "",
      parentCityId: location.parentLocationId ?? "none",
      country: location.country ?? "",
      district: location.district ?? "",
    })
    setIsEditLocationOpen(true)
  }

  const saveLocation = async () => {
    if (!editingLocationId) return

    if (!editLocationData.name) {
      toast.error("Name is required")
      return
    }

    const payload = {
      name: editLocationData.name,
      parentLocationId:
        editLocationData.parentCityId === "none"
          ? null
          : editLocationData.parentCityId,
      country: editLocationData.country || null,
      district: editLocationData.district || null,
    }

    setUpdatingLocationId(editingLocationId)
    try {
      const res = await fetch(`/api/locations/${editingLocationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Failed to update location")
        return
      }

      toast.success("Location updated")
      setIsEditLocationOpen(false)
      setEditingLocationId(null)
      await mutate()
    } catch (error) {
      toast.error("Failed to update location")
      console.error(error)
    } finally {
      setUpdatingLocationId(null)
    }
  }

  const deleteLocation = async (locationId: string) => {
    if (!confirm("Delete this location? This cannot be undone.")) return

    setUpdatingLocationId(locationId)
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Failed to delete location")
        return
      }

      toast.success("Location deleted")
      await mutate()
    } catch (error) {
      toast.error("Failed to delete location")
      console.error(error)
    } finally {
      setUpdatingLocationId(null)
    }
  }

  const createLandmark = async () => {
    if (!newLandmarkData.name) {
      toast.error("Name is required")
      return
    }

    const payload = {
      name: newLandmarkData.name,
      type: "landmark" as const,
      parentLocationId:
        newLandmarkData.parentCityId === "none"
          ? null
          : newLandmarkData.parentCityId,
    }

    setBulkActionLoading(true)
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Failed to create landmark")
        return
      }

      toast.success("Landmark created")
      setIsCreateLandmarkOpen(false)
      setNewLandmarkData({
        name: "",
        parentCityId: "none",
      })

      await mutate()
    } catch (error) {
      toast.error("Failed to create landmark")
      console.error(error)
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Bulk update locations
  const bulkUpdate = async (updates: {
    type?: string | null
    parentLocationId?: string | null
  }) => {
    if (selectedLocationIds.size === 0) return

    setBulkActionLoading(true)
    let successCount = 0
    try {
      // Update each location individually using the PATCH endpoint
      for (const locationId of Array.from(selectedLocationIds)) {
        const res = await fetch(`/api/locations/${locationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: updates.type,
            parentLocationId: updates.parentLocationId,
          }),
        })

        if (res.ok) {
          successCount++
        }
      }

      toast.success(`Updated ${successCount} location(s)`)
      setSelectedLocationIds(new Set())
      await mutate()
    } catch (error) {
      toast.error("Failed to update locations")
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
          country: countryToUse || "",
          district: newCityData.district || "",
          type: "city",
          latitude: 0, // Placeholder, usually needed but for taxonomy maybe optional? 
          // Valid schema requires numbers. We should probably ask for lat/long or default to 0.
          // The schema in route.ts inserts them. Let's assume 0 is fine for "abstract" cities,
          // or we should add lat/long inputs. For now default to 0.
          longitude: 0,
          creatorName: "Admin",
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
      return `Landmarks in: ${selectedCity.name || selectedCity.city || "Unknown City"}`
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
              {cityLocations.length} cities
            </span>
            <span className="flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-amber-400" />
              {landmarkLocations.length} landmarks
            </span>
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-slate-500" />
              {unassignedMarkers.length} unassigned
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
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
            <div className="flex flex-1 min-h-0">
              {/* Column 1: Countries */}
              <div className="flex w-64 flex-col border-r border-white/10 bg-slate-900/30">
                <div className="flex items-center justify-between border-b border-white/10 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Countries
                  </span>
                </div>
                <div ref={countriesScrollRef} className="flex-1 overflow-y-auto p-2">
                  <button
                    onClick={() => {
                      if (countriesScrollRef.current) {
                        countriesScrollRef.current.scrollTop = 0
                      }
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
                      if (countriesScrollRef.current) {
                        countriesScrollRef.current.scrollTop = 0
                      }
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
                        if (countriesScrollRef.current) {
                          countriesScrollRef.current.scrollTop = 0
                        }
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
                <div ref={citiesScrollRef} className="flex-1 overflow-y-auto bg-slate-950/50">
                  <div className="p-2">
                    <div className="space-y-1">
                      {filteredCities.map((city) => (
                        <button
                          key={city.id}
                          onClick={() => {
                            if (citiesScrollRef.current) {
                              citiesScrollRef.current.scrollTop = 0
                            }
                            selectCity(city.id)
                          }}
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
                                  {city.name || city.city || "Unknown"}
                                </span>
                              </div>
                              {city.country && (
                                <p className="ml-6 truncate text-xs text-slate-500">
                                  {city.country}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <span>{city.landmarkCount || 0}</span>
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
                    <div>
                      <h2 className="text-lg font-semibold">{getPanelTitle()}</h2>
                      {displayedLocations.length > 0 && (
                        <span className="text-sm text-slate-400">
                          {displayedLocations.length} marker(s)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCity && (
                        <Button variant="outline" size="sm" onClick={() => openEditLocation(selectedCity)}>
                          Edit City
                        </Button>
                      )}
                      <Dialog open={isCreateLandmarkOpen} onOpenChange={setIsCreateLandmarkOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">Add Landmark</Button>
                        </DialogTrigger>
                        <DialogContent className="border-white/10 bg-slate-900 text-slate-50">
                          <DialogHeader>
                            <DialogTitle>Add Landmark</DialogTitle>
                            <DialogDescription>
                              Create a new landmark location under the selected city.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="new-landmark-name">Name</Label>
                              <Input
                                id="new-landmark-name"
                                placeholder="e.g., Eiffel Tower, Central Park"
                                value={newLandmarkData.name}
                                onChange={(e) => setNewLandmarkData(prev => ({ ...prev, name: e.target.value }))}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="new-landmark-parent">Parent City</Label>
                              <Select
                                value={newLandmarkData.parentCityId}
                                onValueChange={(value) => setNewLandmarkData(prev => ({ ...prev, parentCityId: value }))}
                              >
                                <SelectTrigger id="new-landmark-parent">
                                  <SelectValue placeholder="Select parent city" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No parent city (orphan)</SelectItem>
                                  {cityLocations.map((city) => (
                                    <SelectItem key={city.id} value={city.id}>
                                      {city.name || city.city || "Unknown"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsCreateLandmarkOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={createLandmark} disabled={bulkActionLoading}>
                              {bulkActionLoading ? "Creating..." : "Create Landmark"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Search and bulk actions */}
                  {(viewMode !== "city" || selectedCityId) && displayedLocations.length > 0 && (
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
                        onClick={selectedLocationIds.size === displayedLocations.length ? deselectAll : selectAll}
                        className="h-9"
                      >
                        {selectedLocationIds.size === displayedLocations.length ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                  )}

                  {/* Bulk actions toolbar */}
                  {selectedLocationIds.size > 0 && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg bg-blue-600/10 p-3 ring-1 ring-blue-500/30">
                      <span className="text-sm font-medium">
                        {selectedLocationIds.size} selected
                      </span>
                      <div className="h-4 w-px bg-white/20" />

                      {/* Assign to city */}
                      <Select
                        onValueChange={(value) => bulkUpdate({ parentLocationId: value })}
                        disabled={bulkActionLoading}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder="Assign to city..." />
                        </SelectTrigger>
                        <SelectContent>
                          {cityLocations.map((city) => (
                            <SelectItem key={city.id} value={city.id}>
                              {city.name || city.city || "Unknown"} ({city.country || ""})
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
                          onClick={() => bulkUpdate({ parentLocationId: null })}
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
                  ) : displayedLocations.length === 0 ? (
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
                      {displayedLocations.map((loc) => (
                        <div
                          key={loc.id}
                          className={`rounded-lg border bg-slate-900/60 p-4 transition-colors ${selectedLocationIds.has(loc.id)
                            ? "border-blue-500/50 bg-blue-600/10"
                            : "border-white/10 hover:border-white/20"
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <Checkbox
                              checked={selectedLocationIds.has(loc.id)}
                              onCheckedChange={() => toggleLocationSelection(loc.id)}
                              className="mt-1"
                            />

                            {/* Location info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {loc.type === "city" ? (
                                  <Building2 className="h-4 w-4 text-blue-400" />
                                ) : loc.type === "landmark" ? (
                                  <Landmark className="h-4 w-4 text-amber-400" />
                                ) : (
                                  <MapPin className="h-4 w-4 text-slate-400" />
                                )}
                                <span className="font-medium">
                                  {loc.name || loc.city || "Unnamed"}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-400">
                                {loc.city}, {loc.country} &bull; {loc.markerCount} markers
                              </p>
                              <a
                                href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-0.5 font-mono text-xs text-slate-500 hover:text-blue-400 hover:underline"
                              >
                                {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                              </a>
                            </div>

                            {/* Individual actions */}
                            <div className="flex items-center gap-2">
                              {updatingLocationId === loc.id && (
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditLocation(loc)}
                                className="h-8 text-xs"
                              >
                                <Edit2 className="mr-1 h-3 w-3" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteLocation(loc.id)}
                                className="h-8 text-xs text-red-300 hover:text-red-200"
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Delete
                              </Button>

                              {/* Parent city selector for landmarks */}
                              {loc.type === "landmark" && (
                              <Select
                                value={loc.parentLocationId || "none"}
                                onValueChange={(value) =>
                                  updateLocation(loc.id, { parentLocationId: value === "none" ? null : value })
                                }
                                disabled={updatingLocationId === loc.id}
                              >
                                <SelectTrigger className="h-8 w-40 text-xs">
                                  <SelectValue placeholder="Assign to city..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No parent city</SelectItem>
                                  {cityLocations.map((city) => (
                                    <SelectItem key={city.id} value={city.id}>
                                      {city.name || city.city || "Unknown"} ({city.country || ""})
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

      <Dialog open={isEditLocationOpen} onOpenChange={setIsEditLocationOpen}>
        <DialogContent className="border-white/10 bg-slate-900 text-slate-50">
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>
              Update location name and hierarchy.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-location-name">Name</Label>
              <Input
                id="edit-location-name"
                value={editLocationData.name}
                onChange={(e) => setEditLocationData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-country">Country</Label>
              <Input
                id="edit-country"
                placeholder="e.g. Belarus, France"
                value={editLocationData.country}
                onChange={(e) => setEditLocationData(prev => ({ ...prev, country: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-district">District / State (Optional)</Label>
              <Input
                id="edit-district"
                placeholder="e.g. Île-de-France"
                value={editLocationData.district}
                onChange={(e) => setEditLocationData(prev => ({ ...prev, district: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-parent">Parent City</Label>
              <Select
                value={editLocationData.parentCityId}
                onValueChange={(value) => setEditLocationData(prev => ({ ...prev, parentCityId: value }))}
              >
                <SelectTrigger id="edit-parent">
                  <SelectValue placeholder="No parent city" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent city (orphan)</SelectItem>
                  {cityLocations.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name || city.city || "Unknown"} ({city.country || ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditLocationOpen(false)}>Cancel</Button>
            <Button onClick={saveLocation} disabled={updatingLocationId === editingLocationId}>
              {updatingLocationId === editingLocationId ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

