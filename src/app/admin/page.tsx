"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, LogOut, Plus, MapPin, Map, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { groupMarkersByVideo } from "@/lib/group-markers"
import { extractYouTubeId, getYouTubeThumbnailUrl } from "@/lib/youtube"
import { VideoCard } from "@/components/admin/video-card"
import { SiteFooter } from "@/components/site-footer"
import type { Marker } from "@/types/markers"

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(async (res) => {
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || "Failed to load")
    }
    return res.json()
  })

export default function AdminPage() {
  const router = useRouter()
  const { data: authData, isLoading: authLoading } = useSWR<{ authenticated: boolean }>(
    "/api/auth/check",
    fetcher,
  )

  const { data, error, isLoading, mutate } = useSWR<Marker[]>("/api/markers", fetcher)

  // Add-video flow
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [preview, setPreview] = useState<{
    title?: string
    creator?: string
    publishedAt?: string
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [selectedCreator, setSelectedCreator] = useState<string>("")
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>("")

  const newVideoId = useMemo(
    () => extractYouTubeId(newVideoUrl.trim()),
    [newVideoUrl],
  )

  const creatorOptions = useMemo(
    () =>
      Array.from(new Set((data ?? []).map((m) => m.creatorName).filter(Boolean))).sort((a, b) =>
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
    return videoGroups.filter(video => video.creatorName === selectedCreator)
  }, [videoGroups, selectedCreator])

  const filteredUncategorized = useMemo(() => {
    if (selectedCreator === "") return []
    if (selectedCreator === "all") return uncategorized
    return uncategorized.filter(marker => marker.creatorName === selectedCreator)
  }, [uncategorized, selectedCreator])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase()
    const matchingMarkers = (data || []).filter(marker => {
      return (
        marker.city?.toLowerCase().includes(query) ||
        marker.district?.toLowerCase().includes(query) ||
        marker.country?.toLowerCase().includes(query) ||
        marker.description?.toLowerCase().includes(query) ||
        marker.title?.toLowerCase().includes(query)
      )
    })

    const { grouped } = groupMarkersByVideo(matchingMarkers)
    return grouped.slice(0, 10)
  }, [searchQuery, data])

  useEffect(() => {
    if (!authLoading && authData && !authData.authenticated) {
      router.push("/login")
    }
  }, [authData, authLoading, router])

  // Auto-pull YouTube details as soon as a valid video URL is entered.
  useEffect(() => {
    if (!newVideoId) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    fetch("/api/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${newVideoId}` }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled && payload) setPreview(payload)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [newVideoId])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    router.push("/login")
  }

  const handleAddVideo = () => {
    if (!newVideoId) {
      toast.error("Enter a valid YouTube video URL")
      return
    }
    router.push(`/edit/${newVideoId}`)
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

      await mutate()
    } catch (error) {
      toast.error("Failed to backfill location data")
      console.error(error)
    } finally {
      setBackfillLoading(false)
    }
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
    toast.success("Marker deleted")
  }

  const goToEditor = (videoUrl: string) => {
    const id = extractYouTubeId(videoUrl)
    if (!id) {
      toast.error("This video has no usable YouTube URL")
      return
    }
    router.push(`/edit/${id}`)
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to map
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Admin Portal</h1>
          </div>

          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Input
              type="text"
              placeholder="Search videos, locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            )}

            {/* Dropdown results */}
            {searchQuery && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full rounded-lg border border-white/10 bg-slate-900 shadow-xl max-h-96 overflow-y-auto z-50">
                {searchResults.map((video) => (
                  <Link
                    key={video.videoUrl}
                    href={`/edit/${extractYouTubeId(video.videoUrl)}`}
                    onClick={() => setSearchQuery("")}
                    className="block px-4 py-3 hover:bg-slate-800 border-b border-white/5 last:border-0"
                  >
                    <p className="font-medium text-slate-50 line-clamp-1">
                      {video.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {video.creatorName} · {video.locationCount} location{video.locationCount !== 1 ? 's' : ''}
                    </p>
                  </Link>
                ))}
              </div>
            )}

            {/* No results message */}
            {searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-4 py-3 z-50">
                <p className="text-sm text-slate-400">No videos found</p>
              </div>
            )}
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

      <main className="mx-auto max-w-4xl space-y-8 p-4 md:p-6">
        {/* Add Video */}
        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="mb-1 text-base font-semibold">Add a video</h2>
          <p className="mb-4 text-sm text-slate-400">
            Paste a YouTube URL. We&apos;ll pull the title, creator, and publish
            date, then take you to the editor to drop locations.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex-1 space-y-3">
              <Input
                autoFocus
                placeholder="https://youtu.be/… or https://www.youtube.com/watch?v=…"
                value={newVideoUrl}
                onChange={(e) => setNewVideoUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddVideo()
                }}
              />

              {newVideoUrl.trim() && !newVideoId && (
                <p className="text-xs text-red-400">
                  That doesn&apos;t look like a YouTube video URL.
                </p>
              )}

              {newVideoId && (
                <div className="flex gap-3 rounded-lg border border-white/10 bg-slate-800/50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getYouTubeThumbnailUrl(`https://www.youtube.com/watch?v=${newVideoId}`) ?? ""}
                    alt=""
                    className="h-16 w-28 shrink-0 rounded object-cover bg-slate-700"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement
                      if (t.src.includes("maxresdefault")) {
                        t.src = t.src.replace("maxresdefault", "hqdefault")
                      }
                    }}
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    {previewLoading ? (
                      <span className="flex items-center gap-2 text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Pulling details from YouTube…
                      </span>
                    ) : preview?.title ? (
                      <>
                        <p className="font-medium text-slate-100 line-clamp-2">
                          {preview.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {preview.creator}
                          {preview.publishedAt
                            ? ` · ${new Date(preview.publishedAt).toLocaleDateString()}`
                            : ""}
                        </p>
                      </>
                    ) : (
                      <span className="text-slate-500">
                        Ready — details will be filled in the editor.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button onClick={handleAddVideo} disabled={!newVideoId} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Video
            </Button>
          </div>
        </section>

        {/* Videos & Locations */}
        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="mb-4 text-base font-semibold">Videos &amp; Locations</h2>

          <div className="mb-4">
            <label htmlFor="creator-select" className="mb-2 block text-sm">
              Select Creator
            </label>
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
            <p className="text-sm text-slate-400">No videos yet. Add one above.</p>
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
                onEditVideo={(v) => goToEditor(v.videoUrl)}
                onAddLocation={(v) => goToEditor(v.videoUrl)}
                onDeleteLocation={handleDelete}
              />
            ))}
          </div>

          {/* Uncategorized Section */}
          {filteredUncategorized.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm text-amber-200">
                  <strong>Action Required:</strong> These markers don&apos;t have a video URL,
                  so they can&apos;t be opened in the editor. Re-add them via &quot;Add a video&quot;
                  above, or delete them.
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
      </main>

      <SiteFooter />
    </div>
  )
}
