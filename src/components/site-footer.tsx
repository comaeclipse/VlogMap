import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-900/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-slate-400 md:flex-row md:px-6">
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/" className="transition-colors hover:text-white">
            Home
          </Link>
          <Link href="/creators" className="transition-colors hover:text-white">
            Creators
          </Link>
          <Link href="/locations" className="transition-colors hover:text-white">
            Locations
          </Link>
          <Link href="/about" className="transition-colors hover:text-white">
            About
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-white">
            Privacy
          </Link>
        </nav>
        <p>© 2026 VlogMap</p>
      </div>
    </footer>
  )
}
