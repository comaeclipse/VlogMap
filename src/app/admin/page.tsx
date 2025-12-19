"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, LogOut, Pencil, Plus, RefreshCw, Trash2, MapPin, Map } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { groupMarkersByVideo } from "@/lib/group-markers"
import { VideoCard } from "@/components/admin/video-card"
import { BatchEditDialog } from "@/components/admin/batch-edit-dialog"
import type { Marker, MarkerInput, VideoGroup, LocationEdit } from "@/types/markers"

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(async (res) => {
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || "Failed to load")
    }
    return res.json()
  })

const fetcherWithVideo = ([url, videoUrl]: [string, string]) =>
  fetch(`${url}?videoUrl=${encodeURIComponent(videoUrl)}`, {
    credentials: "include",
  }).then(async (res) => {
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || "Failed to load")
    }
    return res.json()
  })

const emptyMarker: MarkerInput = {
  title: "",
  creator: "",
  channelUrl: "",
  videoUrl: "",
  description: "",
  latitude: 0,
  longitude: 0,
  city: "",
  district: "",
  country: "",
  videoPublishedAt: "",
  type: undefined,
  parentCityId: undefined,
}

export default function AdminPage() {
  const router = useRouter()
  const { data: authData, isLoading: authLoading } = useSWR<{ authenticated: boolean }>(
    "/api/auth/check",
    fetcher,
  )
  const [form, setForm] = useState<MarkerInput>(emptyMarker)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [batchEditVideo, setBatchEditVideo] = useState<VideoGroup | null>(null)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [selectedCreator, setSelectedCreator] = useState<string>("")
  const [backfillLoading, setBackfillLoading] = useState(false)
  const { data, error, isLoading, mutate } = useSWR<Marker[]>("/api/markers", fetcher)
  const { data: videoMarkers, mutate: mutateVideoMarkers } = useSWR<Marker[]>(
    form.videoUrl ? ["/api/markers", form.videoUrl] : null,
    fetcherWithVideo,
  )
  const creatorOptions = useMemo(
    () =>
      Array.from(new Set((data ?? []).map((m) => m.creator).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [data],
  )
  const { grouped: videoGroups, uncategorized } = useMemo(
    () => groupMarkersByVideo(data || []),
    [data]
  )

  const filteredVideoGroups = useMemo(() => {
    if (selectedCreator === "") return []
    if (selectedCreator === "all") return videoGroups
    return videoGroups.filter(video => video.creator === selectedCreator)
  }, [videoGroups, selectedCreator])

  const filteredUncategorized = useMemo(() => {
    if (selectedCreator === "") return []
    if (selectedCreator === "all") return uncategorized
    return uncategorized.filter(marker => marker.creator === selectedCreator)
  }, [uncategorized, selectedCreator])

  // Get all city markers for parent city dropdown
  const cityMarkers = useMemo(() => {
    return (data || [])
      .filter((m) => m.type === 'city')
      .sort((a, b) => {
        // Sort by creator, then title
        const creatorCompare = a.creatorName.localeCompare(b.creatorName)
        if (creatorCompare !== 0) return creatorCompare
        return a.title.localeCompare(b.title)
      })
  }, [data])

  useEffect(() => {
    if (!authLoading && authData && !authData.authenticated) {
      router.push("/login")
    }
  }, [authData, authLoading, router])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    router.push("/login")
  }

  const handleBackfillGeodata = async () => {
    if (!confirm("This will backfill city/country data for all locations with missing information using Google Maps API. This may take a few minutes and will consume API quota. Continue?")) {
      return
    }

    setBackfillLoading(true)
    toast.info("Starting backfill process...")

    try {
      const res = await fetch("/api/locations/backfill-geodata", {
        method: "POST",
        credentials: "include",
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Backfill failed")
        return
      }

      const results = await res.json()
      toast.success(
        `Backfill complete! Updated ${results.updated} locations${results.failed > 0 ? `, ${results.failed} failed` : ""}`,
      )
      
      // Refresh the markers data
      await mutate()
    } catch (error) {
      toast.error("Failed to backfill location data")
      console.error(error)
    } finally {
      setBackfillLoading(false)
    }
  }

  const handleSave = async () => {
    // Validate video URL for new markers
    if (!editingId && !form.videoUrl) {
      toast.error('Video URL is required for new markers')
      return
    }

    const endpoint = editingId ? `/api/markers/${editingId}` : "/api/markers"
    const method = editingId ? "PUT" : "POST"

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      toast.error(payload?.error || "Could not save marker")
      return
    }

    setForm(emptyMarker)
    setEditingId(null)
    await mutate()
    if (form.videoUrl) {
      await mutateVideoMarkers()
    }
    toast.success(editingId ? "Marker updated" : "Marker created")
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this marker?")) return

    const res = await fetch(`/api/markers/${id}`, {
      method: "DELETE",
      credentials: "include",
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      toast.error(payload?.error || "Could not delete marker")
      return
    }

    await mutate()
    if (form.videoUrl) {
      await mutateVideoMarkers()
    }
    toast.success("Marker deleted")
  }

  const handleBatchSave = async (updates: LocationEdit[]) => {
    if (!batchEditVideo) return

    const res = await fetch('/api/markers/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        videoUrl: batchEditVideo.videoUrl,
        updates,
      }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      toast.error(payload?.error || 'Could not save changes')
      return
    }

    await mutate()
    toast.success(`Updated ${updates.length} location(s)`)
  }

  const handleAddLocationToVideo = (video: VideoGroup) => {
    setEditingId(null)
    setForm({
      title: video.title,
      creatorName: video.creatorName,
      channelUrl: video.channelUrl ?? "",
      videoUrl: video.videoUrl,
      videoPublishedAt: video.videoPublishedAt ?? "",
      description: "",
      latitude: 0,
      longitude: 0,
      city: "",
      district: "",
      country: "",
      type: undefined,
      parentCityId: undefined,
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const startEdit = (marker: Marker) => {
    setEditingId(marker.id)
    setForm({
      title: marker.title,
      creatorName: marker.creatorName,
      channelUrl: marker.channelUrl ?? "",
      videoUrl: marker.videoUrl ?? "",
      description: marker.description ?? "",
      latitude: marker.latitude,
      longitude: marker.longitude,
      city: marker.city ?? "",
      district: marker.district ?? "",
      country: marker.country ?? "",
      videoPublishedAt: marker.videoPublishedAt ?? "",
      type: marker.type,
      parentCityId: marker.parentCityId,
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyMarker)
  }

  const startDuplicate = (marker: Marker) => {
    setEditingId(null)
    setForm({
      title: marker.title,
      creatorName: marker.creatorName,
      channelUrl: marker.channelUrl ?? "",
      videoUrl: marker.videoUrl ?? "",
      description: marker.description ?? "",
      latitude: marker.latitude,
      longitude: marker.longitude,
      city: marker.city ?? "",
      district: marker.district ?? "",
      country: marker.country ?? "",
      videoPublishedAt: marker.videoPublishedAt ?? "",
      type: marker.type,
      parentCityId: marker.parentCityId,
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const addLocationForVideo = () => {
    setEditingId(null)
    setForm((prev) => ({
      ...prev,
      latitude: 0,
      longitude: 0,
      city: "",
      district: "",
      country: "",
      description: "",
      type: undefined,
      parentCityId: undefined,
    }))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const fetchMetadata = async () => {
    if (!form.videoUrl) {
      toast.error("Add a video URL first")
      return
    }
    setMetaLoading(true)
    try {
      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: form.videoUrl }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Could not fetch metadata")
        return
      }
      const payload = (await res.json()) as {
        title?: string
        creator?: string
        publishedAt?: string
      }
      setForm((prev) => ({
        ...prev,
        title: prev.title || payload.title || prev.title,
        creatorName: prev.creatorName || payload.creatorName || prev.creatorName,
        videoPublishedAt: payload.publishedAt || prev.videoPublishedAt,
      }))
      toast.success("Metadata applied")
    } finally {
      setMetaLoading(false)
    }
  }

  const fetchCity = async () => {
    if (Number.isNaN(form.latitude) || Number.isNaN(form.longitude)) {
      toast.error("Enter coordinates first")
      return
    }
    setGeoLoading(true)
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ latitude: form.latitude, longitude: form.longitude }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        toast.error(payload?.error || "Could not lookup location")
        return
      }
      const payload = (await res.json()) as {
        city?: string | null
        district?: string | null
        country?: string | null
      }
      if (payload.city || payload.district || payload.country) {
        setForm((prev) => ({
          ...prev,
          city: payload.city || prev.city,
          district: payload.district || prev.district,
          country: payload.country || prev.country,
        }))
        const parts = [payload.city, payload.district, payload.country].filter(Boolean)
        toast.success(`Location: ${parts.join(", ")}`)
      } else {
        toast.error("Location not found")
      }
    } finally {
      setGeoLoading(false)
    }
  }

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
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to map
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Admin Portal</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {isLoading ? "Loading..." : `${data?.length ?? 0} markers`}
            </span>
            <Link href="/admin/locations">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2"
                title="Manage location names"
              >
                <Map className="h-4 w-4" />
                Locations
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackfillGeodata}
              disabled={backfillLoading}
              className="gap-2"
              title="Backfill missing city/country data"
            >
              <MapPin className="h-4 w-4" />
              {backfillLoading ? "Processing..." : "Backfill Geo"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-4 md:p-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form */}
          <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
            <h2 className="mb-4 text-base font-semibold">
              {editingId ? "Edit Marker" : "Add New Marker"}
            </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="City skyline walk"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creator">Creator</Label>
              <Input
                id="creator"
                list="creator-options"
                placeholder="Channel name"
                value={form.creatorName}
                onChange={(e) => setForm({ ...form, creator: e.target.value })}
              />
              <datalist id="creator-options">
                {creatorOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channelUrl">Channel URL</Label>
              <Input
                id="channelUrl"
                placeholder="https://youtube.com/@channel"
                value={form.channelUrl ?? ""}
                onChange={(e) => setForm({ ...form, channelUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="videoUrl">
                Video URL <span className="text-red-400">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="videoUrl"
                  placeholder="https://youtu.be/demo"
                  value={form.videoUrl ?? ""}
                  onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={fetchMetadata}
                  disabled={metaLoading}
                  title="Fetch title, creator, published date"
                >
                  <RefreshCw className={`h-4 w-4 ${metaLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              {!form.videoUrl && !editingId && (
                <p className="text-xs text-red-400">Video URL is required for new markers</p>
              )}
            </div>
            <div className="flex items-center justify-between sm:col-span-2">
              <p className="text-sm text-slate-400">
                {videoMarkers?.length
                  ? `${videoMarkers.length} location${videoMarkers.length > 1 ? "s" : ""} for this video`
                  : "No locations loaded for this video yet"}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={addLocationForVideo}>
                Add location for this video
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="videoPublishedAt">Video published at</Label>
              <Input
                id="videoPublishedAt"
                placeholder="2024-01-01T12:00:00Z"
                value={form.videoPublishedAt ?? ""}
                onChange={(e) => setForm({ ...form, videoPublishedAt: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-3 rounded-lg border border-white/10 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Locations for this video</p>
                  <p className="text-xs text-slate-400">
                    {form.videoUrl
                      ? videoMarkers
                        ? `${videoMarkers.length} location${videoMarkers.length === 1 ? "" : "s"}`
                        : "Loading..."
                      : "Enter a video URL to load locations"}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addLocationForVideo}>
                  Add location
                </Button>
              </div>
              {form.videoUrl && videoMarkers?.length ? (
                <div className="space-y-2">
                  {videoMarkers.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 rounded-md border border-white/10 bg-slate-800/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1 text-sm text-slate-200">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">
                            {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
                            {m.city ? ` · ${m.city}` : ""}
                          </p>
                          {m.type === 'city' && (
                            <Badge variant="secondary" className="text-xs">City</Badge>
                          )}
                          {m.type === 'landmark' && (
                            <Badge variant="default" className="text-xs">Landmark</Badge>
                          )}
                        </div>
                        {m.locationId && (
                          <p className="text-xs text-blue-400 font-mono">
                            📍 {m.locationId}
                          </p>
                        )}
                        {m.parentCityName && (
                          <p className="text-xs text-slate-500">
                            Parent: {m.parentCityName}
                          </p>
                        )}
                        {m.description ? (
                          <p className="text-xs text-slate-400 line-clamp-2">{m.description}</p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(m)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(m.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="coords">Paste Coordinates</Label>
              <Input
                id="coords"
                placeholder="55.8828, 26.5463"
                onChange={(e) => {
                  const match = e.target.value.match(
                    /(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)/
                  )
                  if (match) {
                    setForm({
                      ...form,
                      latitude: parseFloat(match[1]),
                      longitude: parseFloat(match[2]),
                    })
                  }
                }}
              />
              <p className="text-xs text-slate-500">
                Paste &quot;lat, lng&quot; to auto-fill below
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="0.0001"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="0.0001"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="city">City (auto-filled)</Label>
              <div className="flex gap-2">
                <Input
                  id="city"
                  placeholder="City / locality"
                  value={form.city ?? ""}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={fetchCity}
                  disabled={geoLoading}
                  title="Lookup location by coordinates"
                >
                  <RefreshCw className={`h-4 w-4 ${geoLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">District / State</Label>
              <Input
                id="district"
                placeholder="State / Province"
                value={form.district ?? ""}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="Country"
                value={form.country ?? ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Location Type</Label>
              <Select
                value={form.type || "unspecified"}
                onValueChange={(value) => {
                  const newType = value === "unspecified" ? undefined : (value as 'city' | 'landmark')
                  setForm({ 
                    ...form, 
                    type: newType,
                    // Clear parent city if changing to city or unspecified
                    parentCityId: newType === 'landmark' ? form.parentCityId : undefined
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">Unspecified</SelectItem>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="landmark">Landmark</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                City: general exploration; Landmark: specific attraction
              </p>
            </div>
            {form.type === 'landmark' && (
              <div className="space-y-2">
                <Label htmlFor="parentCity">Parent City (Optional)</Label>
                <Select
                  value={form.parentCityId?.toString() || "none"}
                  onValueChange={(value) => {
                    setForm({ 
                      ...form, 
                      parentCityId: value === "none" ? undefined : Number(value)
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent city" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">No parent city</SelectItem>
                    {cityMarkers.map((cm) => (
                      <SelectItem key={cm.id} value={cm.id.toString()}>
                        {cm.city || cm.locationName || "Unknown"} ({cm.creatorName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Associate this landmark with a parent city
                </p>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Night tour, hidden food stalls, aerials..."
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} className="gap-2">
              <Plus className="h-4 w-4" />
              {editingId ? "Update Marker" : "Add Marker"}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
          </section>

          {/* Videos & Locations */}
          <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
            <h2 className="mb-4 text-base font-semibold">Videos & Locations</h2>

            <div className="mb-4">
              <Label htmlFor="creator-select" className="mb-2 block text-sm">
                Select Creator
              </Label>
              <Select value={selectedCreator} onValueChange={setSelectedCreator}>
                <SelectTrigger id="creator-select" className="w-full">
                  <SelectValue placeholder="Choose a creator..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Creators</SelectItem>
                  {creatorOptions.map((creator) => (
                    <SelectItem key={creator} value={creator}>
                      {creator}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error.message}
            </div>
          )}

          {isLoading && !data && (
            <p className="text-sm text-slate-400">Loading markers...</p>
          )}

          {data && data.length === 0 && (
            <p className="text-sm text-slate-400">No markers yet. Add one above.</p>
          )}

          {selectedCreator === "" && data && data.length > 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="mb-3 h-12 w-12 text-slate-500" />
              <p className="text-base text-slate-400">
                Select a creator above to view their videos and locations
              </p>
            </div>
          )}

          {/* Video Groups */}
          <div className="space-y-3">
            {filteredVideoGroups.map(video => (
              <VideoCard
                key={video.videoUrl}
                video={video}
                onEditVideo={(v) => {
                  setBatchEditVideo(v)
                  setBatchDialogOpen(true)
                }}
                onAddLocation={handleAddLocationToVideo}
                onDeleteLocation={handleDelete}
              />
            ))}
          </div>

          {/* Uncategorized Section */}
          {filteredUncategorized.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm text-amber-200">
                  <strong>Action Required:</strong> These markers don't have a video URL.
                  Edit each marker to add a video URL, or delete if no longer needed.
                </p>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-slate-400">
                Uncategorized ({filteredUncategorized.length})
              </h3>

              <div className="space-y-2">
                {filteredUncategorized.map((marker) => (
                  <div
                    key={marker.id}
                    className="flex flex-col gap-3 rounded-lg border border-white/5 bg-slate-800/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{marker.title}</p>
                      <p className="text-sm text-slate-400">
                        {marker.creatorName} &middot; {marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}
                        {marker.city ? ` · ${marker.city}` : ""}
                      </p>
                      {marker.description && (
                        <p className="mt-1 truncate text-sm text-slate-500">{marker.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEdit(marker)}>
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(marker.id)}>
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </section>
        </div>

        {/* Batch Edit Dialog */}
        <BatchEditDialog
          video={batchEditVideo}
          open={batchDialogOpen}
          onOpenChange={setBatchDialogOpen}
          onSave={handleBatchSave}
          cityMarkers={cityMarkers}
        />
      </main>
    </div>
  )
}
