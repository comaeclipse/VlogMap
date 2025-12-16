"use client"

import Link from "next/link"
import useSWR from "swr"
import { AlertCircle, Globe2, MapPin, Users, Video, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { CreatorStats } from "@/types/creators"

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || "Failed to load creator stats")
    }
    return res.json()
  })

export default function CreatorsPage() {
  const { data, error, isLoading } = useSWR<CreatorStats[]>(
    "/api/creators",
    fetcher,
    {
      refreshInterval: 30000,
    },
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sky-200 ring-1 ring-white/10">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Vlog map
              </p>
              <h1 className="text-lg font-semibold text-white">Creators</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="secondary" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Map
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-200">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load creator stats</span>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-slate-400">Loading creators...</p>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                All Creators
                <span className="ml-3 text-lg font-normal text-slate-400">
                  {data.length} creator{data.length !== 1 ? "s" : ""}
                </span>
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((creator) => (
                <Card
                  key={creator.creator}
                  className="border-slate-800 bg-slate-900/50 p-5 transition-colors hover:bg-slate-900/80"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold text-white">
                          {creator.creator}
                        </h3>
                        {creator.channelUrl && (
                          <a
                            href={creator.channelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs text-sky-400 hover:underline"
                          >
                            Visit Channel →
                          </a>
                        )}
                      </div>
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-sky-200">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 border-t border-slate-800 pt-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center text-2xl font-bold text-white">
                          {creator.videoCount}
                        </div>
                        <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                          <Video className="h-3 w-3" />
                          video{creator.videoCount !== 1 ? "s" : ""}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center justify-center text-2xl font-bold text-pink-300">
                          {creator.cityCount}
                        </div>
                        <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                          <Globe2 className="h-3 w-3" />
                          {creator.cityCount === 1 ? "city" : "cities"}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center justify-center text-2xl font-bold text-slate-300">
                          {creator.locationCount}
                        </div>
                        <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3" />
                          location{creator.locationCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Users className="mb-3 h-12 w-12" />
            <p>No creators found</p>
          </div>
        )}
      </main>
    </div>
  )
}
