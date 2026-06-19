import type { Metadata } from "next"
import Link from "next/link"
import { Globe2, MapPin, Users } from "lucide-react"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "About | VlogMap",
  description:
    "VlogMap documents and highlights the beautiful and unique places YouTubers have visited around the world.",
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sky-200 ring-1 ring-white/10">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Vlog map
                </p>
                <h1 className="text-lg font-semibold text-white">Explorer</h1>
              </div>
            </Link>
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

      <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-4xl font-bold">About VlogMap</h1>
        <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-300">
          <p>
            VlogMap is a project dedicated to documenting and highlighting all of
            the beautiful and unique places that YouTubers have visited around the
            world.
          </p>
          <p>
            Every video tells a story tied to a real place — a bustling street
            market, a quiet mountain village, a hidden landmark off the beaten
            path. By mapping where these creators have filmed, VlogMap turns their
            travels into an interactive atlas you can explore, location by
            location.
          </p>
          <p>
            Whether you&apos;re looking for inspiration for your next trip or simply
            love discovering corners of the world through other people&apos;s
            adventures, we hope VlogMap helps you find somewhere worth exploring.
          </p>
        </div>
      </main>
    </div>
  )
}
