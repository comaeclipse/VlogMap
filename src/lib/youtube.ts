const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"]

function isYouTube(url: URL): boolean {
  return YT_HOSTS.includes(url.hostname.toLowerCase())
}

export function extractYouTubeId(urlString: string): string | null {
  try {
    const url = new URL(urlString)

    if (!isYouTube(url)) return null

    const host = url.hostname.toLowerCase()

    // youtu.be/VIDEO_ID format
    if (host === "youtu.be") {
      return url.pathname.slice(1) || null
    }

    // youtube.com?v=VIDEO_ID format
    const searchId = url.searchParams.get("v")
    if (searchId) return searchId

    // /shorts/VIDEO_ID or /embed/VIDEO_ID format
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length >= 2 && (parts[0] === "shorts" || parts[0] === "embed")) {
      return parts[1]
    }

    return null
  } catch {
    return null
  }
}

export function getYouTubeThumbnailUrl(videoUrl: string): string | null {
  const videoId = extractYouTubeId(videoUrl)
  if (!videoId) return null

  // Use maxresdefault for highest quality, falls back to hqdefault in the browser if not available
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
}

// Per-video cache of the best thumbnail URL we've confirmed exists. maxresdefault
// only exists for videos uploaded at >=720p; everything else 404s. The cache
// lives for the lifetime of the server instance so we probe each video at most
// once. Keyed by video ID, value is the resolved thumbnail URL.
const thumbnailUrlCache = new Map<string, string>()

/**
 * Server-side variant that returns a thumbnail URL guaranteed to exist.
 * Probes maxresdefault with a HEAD request and falls back to hqdefault (which
 * is present for every video) when it 404s. Unlike the client-side onError
 * fallback, this works in contexts that can't run JS — notably the OpenGraph
 * <meta> image used for link/social previews. Result is cached per video.
 */
export async function getBestYouTubeThumbnailUrl(
  videoUrl: string,
): Promise<string | null> {
  const videoId = extractYouTubeId(videoUrl)
  if (!videoId) return null

  const cached = thumbnailUrlCache.get(videoId)
  if (cached) return cached

  const maxres = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  const hq = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

  try {
    const res = await fetch(maxres, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    })
    const best = res.ok ? maxres : hq
    thumbnailUrlCache.set(videoId, best)
    return best
  } catch {
    // Network error / timeout probing — return hqdefault without caching so a
    // later request can retry the probe.
    return hq
  }
}
