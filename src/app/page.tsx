"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { AlertCircle, Globe2, MapPin, Plus, ShieldHalf } from "lucide-react"

import { Button } from "@/components/ui/button"
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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sky-200 ring-1 ring-white/10">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Vlog map</p>
              <h1 className="text-lg font-semibold text-white">Explorer</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-pink-300" />
              {isLoading ? "Loading..." : `${data?.length ?? 0} markers`}
            </span>
            {error ? (
              <span className="flex items-center gap-1 text-amber-200">
                <AlertCircle className="h-4 w-4" /> API error
              </span>
            ) : null}
            <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" className="gap-2">
                  <ShieldHalf className="h-4 w-4" />
                  Manage
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader className="space-y-1">
                  <SheetTitle>Manage markers</SheetTitle>
                  <SheetDescription>Protected CRUD using your admin secret.</SheetDescription>
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
        </div>
      </header>

      <main className="flex-1">
        <MapCanvas markers={data || []} onSelect={setSelected} focusMarker={selected} />
      </main>
    </div>
  )
}

