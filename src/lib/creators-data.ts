import { query } from "./db"
import type { CreatorStats } from "@/types/creators"

type CreatorStatsRow = {
  creator_name: string
  video_count: string
  city_count: string
  location_count: string
  channel_url: string | null
  channel_id: string | null
  handle: string | null
  avatar_url: string | null
}

/**
 * Aggregate per-creator stats (video/city/location counts + channel metadata).
 * Shared by the /creators page (server-rendered) and the /api/creators route.
 */
export async function getCreatorStats(): Promise<CreatorStats[]> {
  const result = await query<CreatorStatsRow>(`
    SELECT
      c.name as creator_name,
      COUNT(DISTINCT m.video_url) as video_count,
      COUNT(DISTINCT m.city) FILTER (WHERE m.city IS NOT NULL) as city_count,
      COUNT(*) as location_count,
      c.channel_url,
      c.channel_id,
      c.handle,
      c.avatar_url
    FROM creators c
    LEFT JOIN explorer_markers m ON m.creator_id = c.id
    GROUP BY c.id, c.name, c.channel_url, c.channel_id, c.handle, c.avatar_url
    ORDER BY video_count DESC, c.name ASC
  `)

  return result.rows.map((row) => ({
    creator: row.creator_name,
    videoCount: parseInt(row.video_count, 10),
    cityCount: parseInt(row.city_count, 10),
    locationCount: parseInt(row.location_count, 10),
    channelUrl: row.channel_url,
    channelId: row.channel_id,
    handle: row.handle,
    avatarUrl: row.avatar_url,
  }))
}
