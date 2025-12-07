"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, LogOut, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/sonner"
import type { Marker, MarkerInput } from "@/types/markers"

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(async (res) => {
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
  videoPublishedAt: "",
}

export default function AdminPage() {
  const router = useRouter()
  const { data: authData, isLoading: authLoading } = useSWR<{ authenticated: boolean }>(
    "/api/auth/check",
    fetcher,
  )
  const { data, error, isLoading, mutate } = useSWR<Marker[]>("/api/markers", fetcher)
  const [form, setForm] = useState<MarkerInput>(emptyMarker)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const creatorOptions = useMemo(
    () =>
      Array.from(new Set((data ?? []).map((m) => m.creator).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [data],
  )

  useEffect(() => {
    if (!authLoading && authData && !authData.authenticated) {
      router.push("/login")
    }
  }, [authData, authLoading, router])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    router.push("/login")
  }

  const handleSave = async () => {
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
    toast.success("Marker deleted")
  }

  const startEdit = (marker: Marker) => {
    setEditingId(marker.id)
    setForm({
      title: marker.title,
      creator: marker.creator,
      channelUrl: marker.channelUrl ?? "",
      videoUrl: marker.videoUrl ?? "",
      description: marker.description ?? "",
      latitude: marker.latitude,
      longitude: marker.longitude,
      videoPublishedAt: marker.videoPublishedAt ?? "",
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyMarker)
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
        creator: prev.creator || payload.creator || prev.creator,
        videoPublishedAt: payload.publishedAt || prev.videoPublishedAt,
      }))
      toast.success("Metadata applied")
    } finally {
      setMetaLoading(false)
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
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 p-4 md:p-6">
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
                value={form.creator}
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
              <Label htmlFor="videoUrl">Video URL</Label>
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

        {/* Marker List */}
        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="mb-4 text-base font-semibold">All Markers</h2>

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

          <div className="space-y-3">
            {data?.map((marker) => (
              <div
                key={marker.id}
                className="flex flex-col gap-3 rounded-lg border border-white/5 bg-slate-800/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{marker.title}</p>
                  <p className="text-sm text-slate-400">
                    {marker.creator} &middot; {marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}
                  </p>
                  {marker.description && (
                    <p className="mt-1 truncate text-sm text-slate-500">{marker.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {marker.channelUrl && (
                      <a
                        href={marker.channelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
                      >
                        Channel
                      </a>
                    )}
                    {marker.videoUrl && (
                      <a
                        href={marker.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
                      >
                        Video
                      </a>
                    )}
                  </div>
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
        </section>
      </main>
    </div>
  )
}
