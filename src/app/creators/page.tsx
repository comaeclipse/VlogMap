"use client"

import Link from "next/link"
import useSWR from "swr"
import { AlertCircle, Globe2, MapPin, Video, ArrowLeft, Compass, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CreatorStats } from "@/types/creators"
import { getCreatorGradient } from "@/lib/gradients"

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
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');

        .creators-page {
          font-family: 'Inter', sans-serif;
        }

        .creators-title {
          font-family: 'Crimson Pro', serif;
        }

        .creator-card {
          animation: cardReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .creator-card:nth-child(1) { animation-delay: 0.05s; }
        .creator-card:nth-child(2) { animation-delay: 0.1s; }
        .creator-card:nth-child(3) { animation-delay: 0.15s; }
        .creator-card:nth-child(4) { animation-delay: 0.2s; }
        .creator-card:nth-child(5) { animation-delay: 0.25s; }
        .creator-card:nth-child(6) { animation-delay: 0.3s; }
        .creator-card:nth-child(7) { animation-delay: 0.35s; }
        .creator-card:nth-child(8) { animation-delay: 0.4s; }
        .creator-card:nth-child(9) { animation-delay: 0.45s; }
        .creator-card:nth-child(n+10) { animation-delay: 0.5s; }

        @keyframes cardReveal {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .creator-card:hover {
          transform: translateY(-8px);
        }

        .creator-card:hover .creator-gradient {
          transform: scale(1.08);
          filter: brightness(1.2);
        }

        .creator-gradient {
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          animation: pulseGlow 3s ease-in-out infinite;
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.1),
                        0 0 40px rgba(255, 255, 255, 0.05);
          }
          50% {
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.15),
                        0 0 60px rgba(255, 255, 255, 0.08);
          }
        }

        .stat-number {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .creator-card:hover .stat-number {
          transform: scale(1.1);
        }

        .atlas-bg {
          background:
            radial-gradient(ellipse 800px 600px at 50% -20%, rgba(59, 130, 246, 0.08), transparent),
            radial-gradient(ellipse 600px 400px at 80% 80%, rgba(236, 72, 153, 0.06), transparent);
        }

        .noise-texture {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E");
        }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sky-200 ring-1 ring-white/10">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Vlog map
                </p>
                <h1 className="text-lg font-semibold text-white">Explorer</h1>
              </div>
            </div>
            <Link href="/creators">
              <Button variant="ghost" className="gap-2 text-slate-300 hover:text-white">
                <Users className="h-4 w-4" />
                Creators
              </Button>
            </Link>
            <Link href="/locations">
              <Button variant="ghost" className="gap-2 text-slate-300 hover:text-white">
                <MapPin className="h-4 w-4" />
                Locations
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="creators-page atlas-bg noise-texture relative mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        {error && (
          <div className="mb-8 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-amber-200 backdrop-blur">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">Failed to load creator stats</span>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400"></div>
            <p className="mt-4 text-sm text-slate-500">Discovering explorers...</p>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-10">
            <div className="flex items-end justify-between border-b border-white/5 pb-6">
              <div>
                <h2 className="creators-title text-5xl font-bold text-white md:text-6xl">
                  Explorers
                </h2>
                <p className="mt-3 text-lg text-slate-400">
                  {data.length} creator{data.length !== 1 ? "s" : ""} documenting the world
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.map((creator, index) => {
                const gradient = getCreatorGradient(creator.creator)

                return (
                  <div
                    key={creator.creator}
                    className="creator-card group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-6 backdrop-blur-sm"
                    style={{
                      boxShadow: '0 4px 24px -2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    {/* Gradient glow background */}
                    <div
                      className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-20 blur-3xl"
                      style={{ background: gradient }}
                    />

                    <div className="relative space-y-5">
                      {/* Creator Avatar & Name */}
                      <div className="flex items-start gap-4">
                        <div
                          className="creator-gradient h-16 w-16 flex-shrink-0 rounded-full border-2 border-white/10"
                          style={{
                            background: gradient,
                          }}
                        />
                        <div className="min-w-0 flex-1 pt-1">
                          <Link
                            href={`/creator/${encodeURIComponent(creator.creator)}`}
                            className="group/link"
                          >
                            <h3 className="creators-title text-xl font-semibold text-white transition-colors group-hover/link:text-blue-300">
                              {creator.creator}
                            </h3>
                          </Link>
                          {creator.channelUrl && (
                            <a
                              href={creator.channelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1.5 inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-blue-400"
                            >
                              YouTube Channel
                              <span className="text-[10px]">↗</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-4 rounded-xl border border-white/5 bg-black/20 p-4">
                        <div className="text-center">
                          <div className="stat-number text-2xl font-bold text-white">
                            {creator.videoCount}
                          </div>
                          <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                            <Video className="h-3 w-3" />
                            <span>Video{creator.videoCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>

                        <div className="text-center border-x border-white/5">
                          <div className="stat-number text-2xl font-bold text-pink-400">
                            {creator.cityCount}
                          </div>
                          <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                            <Globe2 className="h-3 w-3" />
                            <span>{creator.cityCount === 1 ? "City" : "Cities"}</span>
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="stat-number text-2xl font-bold text-blue-400">
                            {creator.locationCount}
                          </div>
                          <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                            <MapPin className="h-3 w-3" />
                            <span>Pin{creator.locationCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/30 py-24 backdrop-blur">
            <div className="mb-4 rounded-full bg-slate-800/50 p-4">
              <Compass className="h-8 w-8 text-slate-600" />
            </div>
            <p className="text-slate-500">No explorers discovered yet</p>
          </div>
        )}
      </main>
    </div>
  )
}
