import type { Metadata } from "next"
import Link from "next/link"
import { Globe2, MapPin, Users } from "lucide-react"

import { Button } from "@/components/ui/button"

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

        <div className="mt-6 space-y-6 text-slate-300 leading-relaxed">
          <p>
            VlogMap is built to be as privacy-respecting as possible. We do not
            require registration, we do not ask for any personal information, and
            we do not run advertising or third-party tracking.
          </p>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-white">What we don&apos;t collect</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>No accounts or registration — there is nothing to sign up for.</li>
              <li>No cookies are set for tracking or advertising.</li>
              <li>No personal information is requested, stored, or sold.</li>
              <li>No server-side logging of your activity.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-white">Analytics</h2>
            <p>
              We use Vercel Analytics to understand general, aggregate site usage
              such as how many people visit and which pages are popular. This is
              privacy-friendly analytics that does not use cookies and is not used
              to identify individual visitors. For details on exactly what Vercel
              collects and retains, please see{" "}
              <a
                href="https://vercel.com/docs/analytics/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline underline-offset-4 hover:text-blue-300"
              >
                Vercel&apos;s Analytics privacy documentation
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-white">Changes to this policy</h2>
            <p>
              If this policy ever changes, the updated version will be posted on
              this page.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
