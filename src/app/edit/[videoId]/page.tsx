"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, Upload, Trash2, Save, Loader2 } from "lucide-react"

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

  // Filter markers by videoId
  useEffect(() => {
    if (!allMarkers) return

    const matchingMarkers = allMarkers.filter((m) => {
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
      }))
    )
  }, [allMarkers, videoId])

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

      const res = await fetch("/api/markers/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          videoUrl,
          updates: locations,
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

      await mutate()
      toast.success("Changes saved")
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
              <h3 className="mb-4 text-base font-semibold">
                {location.locationName ? (
                  <>
                    Location {index + 1}:{" "}
                    <span className="text-blue-400">{location.locationName}</span>
                  </>
                ) : (
                  `Location ${index + 1}`
                )}
              </h3>
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
                          {cityMarkers.map((city) => (
                            <SelectItem key={city.id} value={city.id.toString()}>
                              {city.creator} - {city.title}
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
    </div>
  )
}
