import { NextResponse, type NextRequest } from "next/server"

const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]

function isYouTube(url: URL) {
  return YT_HOSTS.includes(url.hostname.toLowerCase())
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const rawUrl = body?.url
  if (!rawUrl || typeof rawUrl !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  if (!isYouTube(parsed)) {
    return NextResponse.json({ error: "Only YouTube URLs are supported" }, { status: 400 })
  }

  try {
    const oembed = new URL("https://www.youtube.com/oembed")
    oembed.searchParams.set("url", parsed.toString())
    oembed.searchParams.set("format", "json")

    const res = await fetch(oembed.toString())
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 400 })
    }
    const data = await res.json()
    return NextResponse.json({
      title: data?.title ?? null,
      creator: data?.author_name ?? null,
    })
  } catch (error) {
    console.error("Metadata fetch failed", error)
    return NextResponse.json({ error: "Metadata fetch failed" }, { status: 500 })
  }
}


