/**
 * Resolve YouTube channel identity + branding via the YouTube Data API.
 * Reuses the same YOUTUBE_API_KEY as the video metadata route.
 */

export type ChannelMeta = {
  channelId: string
  /** @handle without the leading "@" where available (snippet.customUrl). */
  handle: string | null
  /** Channel logo / avatar URL. */
  avatarUrl: string | null
  /** Channel display title. */
  title: string | null
  /** Canonical channel URL (handle form when available, else /channel/<id>). */
  channelUrl: string
}

/**
 * Look up the owning channel id (and title) for a given video id.
 * Returns null if the video can't be resolved.
 */
export async function fetchChannelIdForVideo(
  videoId: string,
  apiKey: string,
): Promise<{ channelId: string; channelTitle: string | null } | null> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos")
  url.searchParams.set("part", "snippet")
  url.searchParams.set("id", videoId)
  url.searchParams.set("key", apiKey)

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } })
  if (!res.ok) return null

  const data = await res.json()
  const snippet = data?.items?.[0]?.snippet
  if (!snippet?.channelId) return null

  return {
    channelId: snippet.channelId as string,
    channelTitle: (snippet.channelTitle as string) ?? null,
  }
}

/**
 * Fetch channel branding (handle, avatar, title) for a channel id.
 * Picks the highest-resolution avatar thumbnail available.
 */
export async function fetchChannelMeta(
  channelId: string,
  apiKey: string,
): Promise<ChannelMeta | null> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels")
  url.searchParams.set("part", "snippet")
  url.searchParams.set("id", channelId)
  url.searchParams.set("key", apiKey)

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } })
  if (!res.ok) return null

  const snippet = (await res.json())?.items?.[0]?.snippet
  if (!snippet) return null

  const thumbs = snippet.thumbnails ?? {}
  const avatarUrl: string | null =
    thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null

  // customUrl looks like "@baldandbankrupt"; normalize to bare handle.
  const rawHandle: string | undefined = snippet.customUrl
  const handle = rawHandle ? rawHandle.replace(/^@/, "") : null

  const channelUrl = handle
    ? `https://www.youtube.com/@${handle}`
    : `https://www.youtube.com/channel/${channelId}`

  return {
    channelId,
    handle,
    avatarUrl,
    title: (snippet.title as string) ?? null,
    channelUrl,
  }
}
