import { Pool } from "pg"

type MarkerRow = {
  id: number
  title: string
  creator: string
  channel_url: string | null
  video_url: string | null
  description: string | null
  latitude: number
  longitude: number
  created_at: string
}

let pool: Pool | null = null
let schemaReady: Promise<void> | null = null

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured")
    }
    pool = new Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    })
  }
  return pool
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS explorer_markers (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          creator TEXT NOT NULL,
          channel_url TEXT,
          video_url TEXT,
          description TEXT,
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
    })()
  }
  return schemaReady
}

type QueryParam = string | number | boolean | null

export async function query<T = unknown>(text: string, params?: QueryParam[]) {
  await ensureSchema()
  const result = await getPool().query<T>(text, params)
  return result
}

export function mapMarkerRow(row: MarkerRow) {
  return {
    id: row.id,
    title: row.title,
    creator: row.creator,
    channelUrl: row.channel_url,
    videoUrl: row.video_url,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
  }
}
