import { NextResponse, type NextRequest } from "next/server"

const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"]

function isYouTube(url: URL) {
  return YT_HOSTS.includes(url.hostname.toLowerCase())
}

function extractYouTubeId(url: URL) {
  const host = url.hostname.toLowerCase()
  if (host === "youtu.be") {
    return url.pathname.slice(1) || null
  }
  const searchId = url.searchParams.get("v")
  if (searchId) return searchId
  const parts = url.pathname.split("/").filter(Boolean)
  // /shorts/{id} or /embed/{id}
  if (parts.length >= 2 && (parts[0] === "shorts" || parts[0] === "embed")) {
    return parts[1]
  }
  return null
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

  const videoId = extractYouTubeId(parsed)
  if (!videoId) {
    return NextResponse.json({ error: "Could not parse video id" }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY is not configured on the server" },
      { status: 500 },
    )
  }

  try {
    const apiUrl = new URL("https://www.googleapis.com/youtube/v3/videos")
    apiUrl.searchParams.set("part", "snippet")
    apiUrl.searchParams.set("id", videoId)
    apiUrl.searchParams.set("key", apiKey)

    const res = await fetch(apiUrl.toString(), { next: { revalidate: 3600 } })
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 400 })
    }
    const data = await res.json()
    const item = data?.items?.[0]?.snippet
    return NextResponse.json({
      title: item?.title ?? null,
      creator: item?.channelTitle ?? null,
      publishedAt: item?.publishedAt ?? null,
    })
  } catch (error) {
    console.error("Metadata fetch failed", error)
    return NextResponse.json({ error: "Metadata fetch failed" }, { status: 500 })
  }
}



