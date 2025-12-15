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
