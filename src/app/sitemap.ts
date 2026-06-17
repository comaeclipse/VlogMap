import type { MetadataRoute } from "next"

import { query } from "@/lib/db"
import { extractYouTubeId } from "@/lib/youtube"
import { siteUrl } from "@/lib/site"

// Regenerate at most hourly so newly added creators/videos/locations get picked
// up without rebuilding.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/creators`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/locations`, changeFrequency: "weekly", priority: 0.8 },
  ]

  try {
    const [creators, videos, locations] = await Promise.all([
      query<{ channel_id: string }>(
        "SELECT channel_id FROM creators WHERE channel_id IS NOT NULL",
      ),
      query<{ video_url: string; last_modified: string | null }>(
        `SELECT video_url, MAX(created_at) AS last_modified
           FROM explorer_markers
          WHERE video_url IS NOT NULL
          GROUP BY video_url`,
      ),
      query<{ id: string; updated_at: string | null }>(
        "SELECT id, updated_at FROM locations",
      ),
    ])

    const creatorPages: MetadataRoute.Sitemap = creators.rows.map((row) => ({
      url: `${siteUrl}/creator/${encodeURIComponent(row.channel_id)}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }))

    const videoPages: MetadataRoute.Sitemap = videos.rows.flatMap((row) => {
      const id = extractYouTubeId(row.video_url)
      if (!id) return []
      return [
        {
          url: `${siteUrl}/video/${id}`,
          lastModified: row.last_modified
            ? new Date(row.last_modified)
            : undefined,
          changeFrequency: "monthly",
          priority: 0.6,
        },
      ]
    })

    const locationPages: MetadataRoute.Sitemap = locations.rows.map((row) => ({
      url: `${siteUrl}/location/${encodeURIComponent(row.id)}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.6,
    }))

    return [...staticPages, ...creatorPages, ...videoPages, ...locationPages]
  } catch (error) {
    console.error("Failed to build sitemap", error)
    return staticPages
  }
}
