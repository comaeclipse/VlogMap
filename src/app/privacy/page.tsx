import type { Metadata } from "next"
import Link from "next/link"
import { Globe2, MapPin, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "Privacy Policy | VlogMap",
  description: "How VlogMap handles your data — in short, we collect almost nothing.",
}

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-400">Effective Date: June 18, 2026</p>

        <div className="mt-6 space-y-6 text-slate-300 leading-relaxed">
          <p>
            VlogMap is a website for exploring map-based video locations,
            timelines, and related public information.
          </p>

          <p>
            We do not ask visitors to create an account, submit personal
            information, or provide precise location data.
          </p>

          <p>
            Like most websites, VlogMap and the services used to operate it may
            process basic technical information automatically. This may include
            information such as your IP address, browser type, device type, pages
            visited, referring page, approximate location, timestamps, and
            performance data. We use this information to operate the site, keep it
            secure, understand general traffic, and improve the experience.
          </p>

          <p>
            VlogMap uses Vercel Analytics to measure general site usage. We use
            this information in an aggregated way and do not use it to personally
            identify visitors.
          </p>

          <p>
            VlogMap uses Leaflet and react-leaflet to display interactive maps.
            Map tiles are loaded from CARTO&rsquo;s Voyager raster basemap
            service, which uses OpenStreetMap data. When your browser loads the
            map, CARTO may receive basic technical information related to those
            map tile requests, such as your IP address, browser details, and the
            map tiles requested.
          </p>

          <p>
            VlogMap does not currently use its own cookies for accounts,
            advertising, or personalization.
          </p>

          <p>
            VlogMap may link to third-party websites, videos, maps, or other
            external content. Those third-party services have their own privacy
            practices, and we are not responsible for how they collect or use
            information.
          </p>

          <p>
            VlogMap does not currently display advertising. If advertising is
            added in the future, this Privacy Policy will be updated to explain
            what advertising services are used and whether cookies, tracking
            technologies, or personalized ads are involved.
          </p>

          <p>
            We may update this Privacy Policy from time to time as the website
            changes. The updated version will be posted on this page with a new
            effective date.
          </p>

          <p>
            If you have questions about this Privacy Policy, contact us at:{" "}
            <a
              href="mailto:vlogmap@gmail.com"
              className="text-blue-400 underline underline-offset-4 hover:text-blue-300"
            >
              vlogmap@gmail.com
            </a>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
