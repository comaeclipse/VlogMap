"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import {
  BadgeCheck,
  Compass,
  Globe2,
  MapPin,
  Plus,
  ShieldHalf,
  Video,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/sonner"
import type { Marker, MarkerInput } from "@/types/markers"

const MapCanvas = dynamic(() => import("@/components/map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-3xl border border-white/10 bg-slate-900/60">
      <p className="text-sm text-slate-400">Loading terrain...</p>
    </div>
  ),
})

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || "Failed to load markers")
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
}

export default function Home() {
  const { data, error, isLoading, mutate } = useSWR<Marker[]>("/api/markers", fetcher, {
    refreshInterval: 15000,
  })
  const [selected, setSelected] = useState<Marker | null>(null)
  const [adminSecret, setAdminSecret] = useState(() => {
    if (typeof window === "undefined") return ""
    return window.localStorage.getItem("vlogmap-admin") || ""
  })
  const [form, setForm] = useState<MarkerInput>(emptyMarker)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)

  useEffect(() => {
    if (adminSecret) {
      window.localStorage.setItem("vlogmap-admin", adminSecret)
    }
  }, [adminSecret])

  const highlight = useMemo(
    () => selected || (data?.length ? data[0] : null),
    [selected, data],
  )

  const handleSave = async () => {
    if (!adminSecret) {
      toast.error("Enter the admin password to save")
      return
    }

    const endpoint = editingId ? `/api/markers/${editingId}` : "/api/markers"
    const method = editingId ? "PUT" : "POST"

    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
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
    setAdminOpen(false)
    toast.success("Marker saved")
  }

  const handleDelete = async (id: number) => {
    if (!adminSecret) {
      toast.error("Enter the admin password to continue")
      return
    }

    const res = await fetch(`/api/markers/${id}`, {
      method: "DELETE",
      headers: { "x-admin-secret": adminSecret },
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      toast.error(payload?.error || "Could not delete marker")
      return
    }

    if (selected?.id === id) setSelected(null)
    await mutate()
    toast.success("Marker removed")
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
    })
    setAdminOpen(true)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0">
        <MapCanvas markers={data || []} onSelect={setSelected} focusMarker={selected} />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,.18),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(236,72,153,.15),transparent_25%),radial-gradient(circle_at_80%_80%,rgba(94,234,212,.12),transparent_28%)]" />

      <div className="relative z-10 flex min-h-screen flex-col justify-between gap-6 p-6 md:p-10">
        <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900/70 p-4 backdrop-blur-lg ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-sky-200 ring-1 ring-white/10">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Vlog atlas</p>
              <h1 className="text-xl font-semibold text-white">Explorer Map</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-emerald-400" />
            <p className="text-xs text-slate-300">
              Live markers • {isLoading ? "loading" : `${data?.length ?? 0} logged`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" className="gap-2">
                  <ShieldHalf className="h-4 w-4" />
                  Manage markers
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader className="space-y-1">
                  <SheetTitle>Private controls</SheetTitle>
                  <SheetDescription>
                    Password-protected CRUD for your Postgres-backed marker collection.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-secret">Admin password</Label>
                    <Input
                      id="admin-secret"
                      type="password"
                      placeholder="••••••••"
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                    />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
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
                        placeholder="Channel name"
                        value={form.creator}
                        onChange={(e) => setForm({ ...form, creator: e.target.value })}
                      />
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
                      <Input
                        id="videoUrl"
                        placeholder="https://youtu.be/demo"
                        value={form.videoUrl ?? ""}
                        onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                      />
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
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Night tour, hidden food stalls, aerials..."
                        value={form.description ?? ""}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handleSave} className="flex-1 gap-2">
                      <Plus className="h-4 w-4" />
                      {editingId ? "Update marker" : "Add marker"}
                    </Button>
                    {editingId ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setForm(emptyMarker)
                          setEditingId(null)
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-200">Existing markers</p>
                      <span className="text-xs text-slate-400">{data?.length ?? 0} total</span>
                    </div>
                    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-3">
                      {data && data.length > 0 ? (
                        data.map((marker) => (
                          <div
                            key={marker.id}
                            className="flex items-start justify-between rounded-lg bg-slate-900/60 p-3 ring-1 ring-white/5"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">{marker.title}</p>
                              <p className="text-xs text-slate-400">
                                {marker.creator} • {marker.latitude.toFixed(3)}, {marker.longitude.toFixed(3)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => startEdit(marker)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(marker.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No markers yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="pointer-events-none grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="pointer-events-auto col-span-1 border-white/10 bg-slate-900/80 text-white backdrop-blur-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Compass className="h-5 w-5 text-sky-300" />
                Field notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-200">
              <p className="leading-6 text-slate-300">
                Minimalist Google Maps–style view, backed by Postgres. Tap any marker to see
                the creator&apos;s drop and jump to their video.
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-100">
                  <MapPin className="h-4 w-4 text-pink-300" />
                  {data?.length ?? 0} markers live
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-100">
                  <Video className="h-4 w-4 text-emerald-300" />
                  Linked YouTube drops
                </div>
              </div>
              {highlight ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">In focus</p>
                  <p className="text-base font-semibold text-white">{highlight.title}</p>
                  <p className="text-sm text-slate-300">{highlight.creator}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {highlight.videoUrl ? (
                      <a
                        className="rounded-full border border-white/10 px-3 py-1 text-slate-200 hover:border-white/20"
                        href={highlight.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Watch video
                      </a>
                    ) : null}
                    {highlight.channelUrl ? (
                      <a
                        className="rounded-full border border-white/10 px-3 py-1 text-slate-200 hover:border-white/20"
                        href={highlight.channelUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Visit channel
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="pointer-events-auto col-span-1 md:col-span-2">
            <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Latest drops</p>
                  <h2 className="text-lg font-semibold text-white">Explorer feed</h2>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  <Globe2 className="h-4 w-4 text-sky-300" />
                  Continuous sync from Postgres
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {isLoading && !data ? (
                  <div className="col-span-2 rounded-xl border border-white/5 bg-white/5 p-4 text-sm text-slate-400">
                    Loading markers...
                  </div>
                ) : null}
                {error ? (
                  <div className="col-span-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
                    {error.message}
                  </div>
                ) : null}
                {data?.map((marker) => (
                  <Card
                    key={marker.id}
                    className="border-white/10 bg-slate-900/80 text-white backdrop-blur"
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                            {marker.creator}
                          </p>
                          <h3 className="text-base font-semibold leading-tight">
                            {marker.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <MapPin className="h-4 w-4 text-pink-300" />
                          {marker.latitude.toFixed(2)}, {marker.longitude.toFixed(2)}
                        </div>
                      </div>
                      {marker.description ? (
                        <p className="text-sm text-slate-300">{marker.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {marker.channelUrl ? (
                          <a
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:border-white/20"
                            href={marker.channelUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Channel
                          </a>
                        ) : null}
                        {marker.videoUrl ? (
                          <a
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:border-white/20"
                            href={marker.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Watch video
                          </a>
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setSelected(marker)
                            toast.info("Centered on map")
                          }}
                        >
                          Focus on map
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-slate-200 hover:bg-white/5"
                          onClick={() => startEdit(marker)}
                        >
                          Quick edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {data && data.length === 0 ? (
                  <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                    No markers yet — add the first drop from the admin panel.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
