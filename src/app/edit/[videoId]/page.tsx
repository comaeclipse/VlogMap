"use client"

import { useEffect, useState, use, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, Upload, Trash2, Save, Loader2, Plus, X, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/sonner"
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
} from "@/components/ui/dialog"
import { RichTextEditor } from "@/components/rich-text-editor"
import { extractYouTubeId } from "@/lib/youtube"
import type { Marker } from "@/types/markers"

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(async (res) => {
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || "Failed to load")
    }
    return res.json()
  })

type LocationEdit = {
  id: number
  latitude: number
  longitude: number
  description: string
  city: string
  screenshotUrl: string
  locationId?: string | null
  locationName?: string | null
  type?: 'city' | 'landmark' | null
  parentCityId?: number | null
  timestamp?: string | null
}

export default function EditVideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>
}) {
  const { videoId } = use(params)
  const router = useRouter()

  const { data: authData } = useSWR<{ authenticated: boolean }>(
    "/api/auth/check",
    fetcher
  )

  const { data: allMarkers, mutate } = useSWR<Marker[]>("/api/markers", fetcher)

  // Sort markers by timestamp for display
  const sortedAllMarkers = useMemo(() => {
    if (!allMarkers) return []
    
    const timestampToSeconds = (timestamp: string | null | undefined): number => {
      if (!timestamp) return Infinity
      const parts = timestamp.split(":").map(Number)
      if (parts.length === 2) return parts[0] * 60 + parts[1]
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
      return Infinity
    }
    
    return [...allMarkers].sort((a, b) => {
      const timeA = timestampToSeconds(a.timestamp)
      const timeB = timestampToSeconds(b.timestamp)
      if (timeA === Infinity && timeB === Infinity) {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      }
      return timeA - timeB
    })
  }, [allMarkers])

  const [locations, setLocations] = useState<LocationEdit[]>([])
  const [videoInfo, setVideoInfo] = useState<{
    title: string
    creator: string
    channelUrl: string
    videoPublishedAt: string
    summary: string
  } | null>(null)
  const [uploadingFor, setUploadingFor] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [newLocations, setNewLocations] = useState<LocationEdit[]>([])
  const [nextTempId, setNextTempId] = useState(-1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [locationToDelete, setLocationToDelete] = useState<{ id: number; isNew: boolean } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [geoLoadingFor, setGeoLoadingFor] = useState<number | null>(null)

  // Filter markers by videoId
  useEffect(() => {
    if (!sortedAllMarkers) return

    const matchingMarkers = sortedAllMarkers.filter((m) => {
      if (!m.videoUrl) return false
      const urlVideoId = extractYouTubeId(m.videoUrl)
      return urlVideoId === videoId
    })

    if (matchingMarkers.length === 0) {
      toast.error("No locations found for this video")
      return
    }

    // Set video info from first marker
    const first = matchingMarkers[0]
    setVideoInfo({
      title: first.title,
      creator: first.creator,
      channelUrl: first.channelUrl ?? "",
      videoPublishedAt: first.videoPublishedAt ?? "",
      summary: first.summary ?? "",
    })

    // Set locations (locationName now comes from the markers API)
    setLocations(
      matchingMarkers.map((m) => ({
        id: m.id,
        latitude: m.latitude,
        longitude: m.longitude,
        description: m.description ?? "",
        city: m.city ?? "",
        screenshotUrl: m.screenshotUrl ?? "",
        locationId: m.locationId,
        locationName: m.locationName ?? null,
        type: m.type,
        parentCityId: m.parentCityId,
        timestamp: m.timestamp ?? "",
      }))
    )
  }, [sortedAllMarkers, videoId])

  useEffect(() => {
    if (authData && !authData.authenticated) {
      router.push("/login")
    }
  }, [authData, router])

  const handleFileUpload = async (locationId: number, file: File) => {
    setUploadingFor(locationId)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("markerId", locationId.toString())

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Upload failed")
      }

      const { url } = await res.json()

      // Update local state
      setLocations((prev) =>
        prev.map((loc) =>
          loc.id === locationId ? { ...loc, screenshotUrl: url } : loc
        )
      )

      toast.success("Screenshot uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploadingFor(null)
    }
  }

  const updateLocation = (
    id: number,
    field: keyof LocationEdit,
    value: string | number | null | undefined
  ) => {
    setLocations((prev) =>
      prev.map((loc) => (loc.id === id ? { ...loc, [field]: value } : loc))
    )
  }

  const handleAddLocation = () => {
    const tempId = nextTempId
    setNextTempId((prev) => prev - 1)
    setNewLocations((prev) => [
      ...prev,
      {
        id: tempId,
        latitude: 0,
        longitude: 0,
        description: "",
        city: "",
        screenshotUrl: "",
        locationId: null,
        locationName: null,
        type: null,
        parentCityId: null,
        timestamp: "",
      },
    ])
  }

  const updateNewLocation = (
    id: number,
    field: keyof LocationEdit,
    value: string | number | null | undefined
  ) => {
    setNewLocations((prev) =>
      prev.map((loc) => (loc.id === id ? { ...loc, [field]: value } : loc))
    )
  }

  const removeNewLocation = (id: number) => {
    setNewLocations((prev) => prev.filter((loc) => loc.id !== id))
  }

  const handleDeleteClick = (id: number, isNew: boolean) => {
    setLocationToDelete({ id, isNew })
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!locationToDelete) return

    if (locationToDelete.isNew) {
      // Just remove from local state
      removeNewLocation(locationToDelete.id)
      setDeleteDialogOpen(false)
      setLocationToDelete(null)
      toast.success("Location removed")
      return
    }

    // Delete from server
    setDeleting(true)
    try {
      const res = await fetch(`/api/markers/${locationToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Failed to delete")
      }

      // Remove from local state
      setLocations((prev) => prev.filter((loc) => loc.id !== locationToDelete.id))
      await mutate()
      toast.success("Location deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setLocationToDelete(null)
    }
  }

  const fetchCityForNew = async (locationId: number) => {
    const location = newLocations.find((l) => l.id === locationId)
    if (!location || isNaN(location.latitude) || isNaN(location.longitude)) {
      toast.error("Enter coordinates first")
      return
    }
    if (location.latitude === 0 && location.longitude === 0) {
      toast.error("Enter coordinates first")
      return
    }

    setGeoLoadingFor(locationId)
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude }),
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
        updateNewLocation(locationId, "city", payload.city || "")
        const parts = [payload.city, payload.district, payload.country].filter(Boolean)
        toast.success(`Location: ${parts.join(", ")}`)
      } else {
        toast.error("Location not found")
      }
    } finally {
      setGeoLoadingFor(null)
    }
  }

  // Get city markers for parent dropdown
  const cityMarkers = allMarkers?.filter((m) => m.type === 'city') || []

  const handleSave = async () => {
    setSaving(true)
    try {
      // Find the video URL from original markers
      const videoUrl = allMarkers?.find((m) => {
        const urlVideoId = extractYouTubeId(m.videoUrl ?? "")
        return urlVideoId === videoId
      })?.videoUrl

      if (!videoUrl) {
        throw new Error("Could not find video URL")
      }

      if (!videoInfo) {
        throw new Error("Video info not loaded")
      }

      // Helper to convert timestamp to seconds
      const timestampToSeconds = (timestamp: string | null | undefined): number => {
        if (!timestamp) return Infinity
        const parts = timestamp.split(":").map(Number)
        if (parts.length === 2) return parts[0] * 60 + parts[1]
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
        return Infinity
      }

      // Create new locations first
      for (const newLoc of newLocations) {
        const createRes = await fetch("/api/markers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: videoInfo.title,
            creator: videoInfo.creator,
            channelUrl: videoInfo.channelUrl || undefined,
            videoUrl,
            videoPublishedAt: videoInfo.videoPublishedAt || undefined,
            summary: videoInfo.summary || undefined,
            latitude: newLoc.latitude,
            longitude: newLoc.longitude,
            city: newLoc.city || undefined,
            description: newLoc.description || undefined,
            type: newLoc.type || undefined,
            parentCityId: newLoc.parentCityId || undefined,
            timestamp: newLoc.timestamp || undefined,
            screenshotUrl: newLoc.screenshotUrl || undefined,
            locationName: newLoc.locationName || undefined,
          }),
        })

        if (!createRes.ok) {
          const error = await createRes.json().catch(() => ({}))
          throw new Error(error.error || "Failed to create new location")
        }
      }

      // Clear new locations after creation
      setNewLocations([])

      // Sort existing locations by timestamp before saving
      const sortedLocations = [...locations].sort((a, b) => {
        return timestampToSeconds(a.timestamp) - timestampToSeconds(b.timestamp)
      })

      // Batch update existing locations (only if there are any)
      if (sortedLocations.length > 0) {
        const res = await fetch("/api/markers/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            videoUrl,
            updates: sortedLocations,
            videoMetadata: {
              title: videoInfo.title,
              creator: videoInfo.creator,
              channelUrl: videoInfo.channelUrl || undefined,
              videoPublishedAt: videoInfo.videoPublishedAt || undefined,
              summary: videoInfo.summary || undefined,
            },
          }),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || "Failed to save")
        }
      }

      await mutate()
      toast.success("Changes saved and sorted by timestamp")
      router.push("/admin")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (!authData?.authenticated || !videoInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Edit Video Locations</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        {/* Video Metadata Card */}
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
          <h3 className="mb-4 text-lg font-semibold">Video Metadata</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="video-title">Title</Label>
              <Input
                id="video-title"
                value={videoInfo.title}
                onChange={(e) =>
                  setVideoInfo({ ...videoInfo, title: e.target.value })
                }
                placeholder="Video title"
              />
            </div>
            <div>
              <Label htmlFor="video-creator">Creator</Label>
              <Input
                id="video-creator"
                value={videoInfo.creator}
                onChange={(e) =>
                  setVideoInfo({ ...videoInfo, creator: e.target.value })
                }
                placeholder="Creator name"
              />
            </div>
            <div>
              <Label htmlFor="video-channel-url">Channel URL</Label>
              <Input
                id="video-channel-url"
                type="url"
                value={videoInfo.channelUrl}
                onChange={(e) =>
                  setVideoInfo({ ...videoInfo, channelUrl: e.target.value })
                }
                placeholder="https://youtube.com/@channel"
              />
            </div>
            <div>
              <Label htmlFor="video-published-at">Published Date</Label>
              <Input
                id="video-published-at"
                type="date"
                value={
                  videoInfo.videoPublishedAt
                    ? videoInfo.videoPublishedAt.split("T")[0]
                    : ""
                }
                onChange={(e) =>
                  setVideoInfo({
                    ...videoInfo,
                    videoPublishedAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="video-summary">Video Summary</Label>
              <RichTextEditor
                content={videoInfo.summary}
                onChange={(content) =>
                  setVideoInfo({ ...videoInfo, summary: content })
                }
                placeholder="Brief summary of the video content (not the same as YouTube description)"
              />
              <p className="mt-1 text-xs text-slate-400">
                Optional: Add a custom summary to help users understand what this video is about
              </p>
            </div>
          </div>
        </div>

        {/* Locations List */}
        <div className="space-y-4">
          {locations.map((location, index) => (
            <div
              key={location.id}
              className="rounded-xl border border-white/10 bg-slate-900/60 p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  {location.locationName ? (
                    <>
                      Location {index + 1}:{" "}
                      <span className="text-blue-400">{location.locationName}</span>
                    </>
                  ) : (
                    `Location ${index + 1}`
                  )}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => handleDeleteClick(location.id, false)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`lat-${location.id}`}>Latitude</Label>
                    <Input
                      id={`lat-${location.id}`}
                      type="number"
                      step="0.0001"
                      value={location.latitude}
                      onChange={(e) =>
                        updateLocation(location.id, "latitude", Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`lng-${location.id}`}>Longitude</Label>
                    <Input
                      id={`lng-${location.id}`}
                      type="number"
                      step="0.0001"
                      value={location.longitude}
                      onChange={(e) =>
                        updateLocation(location.id, "longitude", Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`city-${location.id}`}>City</Label>
                    <Input
                      id={`city-${location.id}`}
                      value={location.city}
                      onChange={(e) =>
                        updateLocation(location.id, "city", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`type-${location.id}`}>Location Type</Label>
                    <Select
                      value={location.type || "unspecified"}
                      onValueChange={(value) => {
                        const newType = value === "unspecified" ? null : (value as 'city' | 'landmark')
                        updateLocation(location.id, "type", newType)
                        // Clear parent if not landmark
                        if (newType !== 'landmark') {
                          updateLocation(location.id, "parentCityId", null)
                        }
                      }}
                    >
                      <SelectTrigger id={`type-${location.id}`}>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unspecified">Unspecified</SelectItem>
                        <SelectItem value="city">City</SelectItem>
                        <SelectItem value="landmark">Landmark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`timestamp-${location.id}`}>
                      Timestamp
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        (hh:mm:ss or mm:ss)
                      </span>
                    </Label>
                    <Input
                      id={`timestamp-${location.id}`}
                      value={location.timestamp || ""}
                      onChange={(e) =>
                        updateLocation(location.id, "timestamp", e.target.value)
                      }
                      placeholder="0:00"
                      pattern="^(\d{1,2}:)?\d{1,2}:\d{2}$"
                    />
                  </div>
                  {location.type === 'landmark' && (
                    <div className="sm:col-span-2">
                      <Label htmlFor={`parent-${location.id}`}>Parent City (Optional)</Label>
                      <Select
                        value={location.parentCityId?.toString() || "none"}
                        onValueChange={(value) => {
                          updateLocation(
                            location.id,
                            "parentCityId",
                            value === "none" ? null : Number(value)
                          )
                        }}
                      >
                        <SelectTrigger id={`parent-${location.id}`}>
                          <SelectValue placeholder="Select parent city" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          <SelectItem value="none">No parent city</SelectItem>
                          {cityMarkers.map((cm) => (
                            <SelectItem key={cm.id} value={cm.id.toString()}>
                              {cm.city || cm.locationName || "Unknown"} ({cm.creator})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Label htmlFor={`name-${location.id}`}>
                      Location Name
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        (optional - e.g., "Lenin Statue", "Trinity Site")
                      </span>
                    </Label>
                    <Input
                      id={`name-${location.id}`}
                      value={location.locationName || ""}
                      onChange={(e) =>
                        updateLocation(location.id, "locationName", e.target.value)
                      }
                      placeholder="Leave blank for generic locations"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`desc-${location.id}`}>Description</Label>
                    <Textarea
                      id={`desc-${location.id}`}
                      value={location.description}
                      onChange={(e) =>
                        updateLocation(location.id, "description", e.target.value)
                      }
                      rows={3}
                    />
                  </div>
                </div>

                {/* Screenshot Upload */}
                <div className="space-y-2">
                  <Label>Screenshot</Label>
                  {location.screenshotUrl ? (
                    <div className="space-y-2">
                      <img
                        src={location.screenshotUrl}
                        alt={`Screenshot for location ${index + 1}`}
                        className="max-h-64 rounded-lg border border-white/10"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const input = document.createElement("input")
                            input.type = "file"
                            input.accept = "image/png,image/jpeg,image/jpg,image/webp"
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0]
                              if (file) handleFileUpload(location.id, file)
                            }
                            input.click()
                          }}
                          disabled={uploadingFor === location.id}
                        >
                          {uploadingFor === location.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Replace
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            updateLocation(location.id, "screenshotUrl", "")
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-white/10 p-8 text-center">
                      <Upload className="mx-auto h-12 w-12 text-slate-400" />
                      <p className="mt-2 text-sm text-slate-400">
                        No screenshot uploaded
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          const input = document.createElement("input")
                          input.type = "file"
                          input.accept = "image/png,image/jpeg,image/jpg,image/webp"
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (file) handleFileUpload(location.id, file)
                          }
                          input.click()
                        }}
                        disabled={uploadingFor === location.id}
                      >
                        {uploadingFor === location.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Screenshot
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* New Locations */}
          {newLocations.map((location, index) => (
            <div
              key={location.id}
              className="rounded-xl border border-dashed border-green-500/30 bg-green-500/5 p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-green-400">
                  New Location {index + 1}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-slate-300"
                  onClick={() => handleDeleteClick(location.id, true)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Paste Coordinates */}
                  <div className="sm:col-span-2">
                    <Label htmlFor={`coords-${location.id}`}>Paste Coordinates</Label>
                    <Input
                      id={`coords-${location.id}`}
                      placeholder="55.8828, 26.5463"
                      onChange={(e) => {
                        const match = e.target.value.match(
                          /(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)/
                        )
                        if (match) {
                          updateNewLocation(location.id, "latitude", parseFloat(match[1]))
                          updateNewLocation(location.id, "longitude", parseFloat(match[2]))
                        }
                      }}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Paste &quot;lat, lng&quot; to auto-fill below
                    </p>
                  </div>
                  <div>
                    <Label htmlFor={`new-lat-${location.id}`}>Latitude</Label>
                    <Input
                      id={`new-lat-${location.id}`}
                      type="number"
                      step="0.0001"
                      value={location.latitude}
                      onChange={(e) =>
                        updateNewLocation(location.id, "latitude", Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`new-lng-${location.id}`}>Longitude</Label>
                    <Input
                      id={`new-lng-${location.id}`}
                      type="number"
                      step="0.0001"
                      value={location.longitude}
                      onChange={(e) =>
                        updateNewLocation(location.id, "longitude", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`new-city-${location.id}`}>City (auto-filled)</Label>
                    <div className="flex gap-2">
                      <Input
                        id={`new-city-${location.id}`}
                        value={location.city}
                        onChange={(e) =>
                          updateNewLocation(location.id, "city", e.target.value)
                        }
                        className="flex-1"
                        placeholder="Click refresh to lookup from coordinates"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => fetchCityForNew(location.id)}
                        disabled={geoLoadingFor === location.id}
                        title="Lookup location by coordinates"
                      >
                        <RefreshCw className={`h-4 w-4 ${geoLoadingFor === location.id ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`new-type-${location.id}`}>Location Type</Label>
                    <Select
                      value={location.type || "unspecified"}
                      onValueChange={(value) => {
                        const newType = value === "unspecified" ? null : (value as 'city' | 'landmark')
                        updateNewLocation(location.id, "type", newType)
                        if (newType !== 'landmark') {
                          updateNewLocation(location.id, "parentCityId", null)
                        }
                      }}
                    >
                      <SelectTrigger id={`new-type-${location.id}`}>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unspecified">Unspecified</SelectItem>
                        <SelectItem value="city">City</SelectItem>
                        <SelectItem value="landmark">Landmark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`new-timestamp-${location.id}`}>
                      Timestamp
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        (hh:mm:ss or mm:ss)
                      </span>
                    </Label>
                    <Input
                      id={`new-timestamp-${location.id}`}
                      value={location.timestamp || ""}
                      onChange={(e) =>
                        updateNewLocation(location.id, "timestamp", e.target.value)
                      }
                      placeholder="0:00"
                      pattern="^(\d{1,2}:)?\d{1,2}:\d{2}$"
                    />
                  </div>
                  {location.type === 'landmark' && (
                    <div className="sm:col-span-2">
                      <Label htmlFor={`new-parent-${location.id}`}>Parent City (Optional)</Label>
                      <Select
                        value={location.parentCityId?.toString() || "none"}
                        onValueChange={(value) => {
                          updateNewLocation(
                            location.id,
                            "parentCityId",
                            value === "none" ? null : Number(value)
                          )
                        }}
                      >
                        <SelectTrigger id={`new-parent-${location.id}`}>
                          <SelectValue placeholder="Select parent city" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          <SelectItem value="none">No parent city</SelectItem>
                          {cityMarkers.map((cm) => (
                            <SelectItem key={cm.id} value={cm.id.toString()}>
                              {cm.city || cm.locationName || "Unknown"} ({cm.creator})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Label htmlFor={`new-name-${location.id}`}>
                      Location Name
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        (optional - e.g., "Lenin Statue", "Trinity Site")
                      </span>
                    </Label>
                    <Input
                      id={`new-name-${location.id}`}
                      value={location.locationName || ""}
                      onChange={(e) =>
                        updateNewLocation(location.id, "locationName", e.target.value)
                      }
                      placeholder="Leave blank for generic locations"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`new-desc-${location.id}`}>Description</Label>
                    <Textarea
                      id={`new-desc-${location.id}`}
                      value={location.description}
                      onChange={(e) =>
                        updateNewLocation(location.id, "description", e.target.value)
                      }
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add Location Button */}
          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={handleAddLocation}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Location
          </Button>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="secondary" onClick={() => router.push("/admin")}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save All Changes
              </>
            )}
          </Button>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              {locationToDelete?.isNew
                ? "Remove this unsaved location?"
                : "Are you sure you want to delete this location? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteDialogOpen(false)
                setLocationToDelete(null)
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
