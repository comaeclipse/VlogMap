import { NextResponse, type NextRequest } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { query } from "@/lib/db"
import { extractYouTubeId } from "@/lib/youtube"
import {
  fetchChannelIdForVideo,
  fetchChannelMeta,
} from "@/lib/youtube-channel"

type CreatorRow = {
  id: number
  name: string
  channel_id: string | null
  sample_video: string | null
}

/**
 * Resolve and persist YouTube channel metadata (channel id, handle, avatar,
 * channel url) for creators. By default only fills creators missing a
 * channel_id; pass { force: true } to refresh all of them.
 */
export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY is not configured on the server" },
      { status: 500 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const force = body?.force === true

  // One representative video per creator, plus current channel_id.
  const { rows } = await query<CreatorRow>(
    `SELECT c.id, c.name, c.channel_id,
            (SELECT m.video_url
               FROM explorer_markers m
              WHERE m.creator_id = c.id AND m.video_url IS NOT NULL
              ORDER BY m.created_at DESC
              LIMIT 1) AS sample_video
       FROM creators c
       ORDER BY c.name`,
  )

  const results: Array<{
    creator: string
    status: "updated" | "skipped" | "failed"
    detail?: string
    channelId?: string
    handle?: string | null
  }> = []

  for (const creator of rows) {
    if (creator.channel_id && !force) {
      results.push({ creator: creator.name, status: "skipped", detail: "already has channel_id" })
      continue
    }
    if (!creator.sample_video) {
      results.push({ creator: creator.name, status: "failed", detail: "no video to resolve from" })
      continue
    }

    const videoId = extractYouTubeId(creator.sample_video)
    if (!videoId) {
      results.push({ creator: creator.name, status: "failed", detail: "could not parse video id" })
      continue
    }

    try {
      const resolved = await fetchChannelIdForVideo(videoId, apiKey)
      if (!resolved) {
        results.push({ creator: creator.name, status: "failed", detail: "video not found via API" })
        continue
      }

      const meta = await fetchChannelMeta(resolved.channelId, apiKey)
      if (!meta) {
        results.push({ creator: creator.name, status: "failed", detail: "channel not found via API" })
        continue
      }

      await query(
        `UPDATE creators
            SET channel_id = $1, handle = $2, avatar_url = $3, channel_url = $4
          WHERE id = $5`,
        [meta.channelId, meta.handle, meta.avatarUrl, meta.channelUrl, creator.id],
      )

      results.push({
        creator: creator.name,
        status: "updated",
        channelId: meta.channelId,
        handle: meta.handle,
      })
    } catch (error) {
      console.error(`Failed to resolve channel for ${creator.name}`, error)
      results.push({ creator: creator.name, status: "failed", detail: "unexpected error" })
    }
  }

  const updated = results.filter((r) => r.status === "updated").length
  return NextResponse.json({ updated, total: rows.length, results })
}
