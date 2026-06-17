import { Pool } from "pg"
import type { QueryResult, QueryResultRow } from "pg"

// ---------------------------------------------------------------------------
// Schema ownership
//
// This module NO LONGER creates or alters database schema. The schema is owned
// entirely by the SQL files in the project-root `migrations/` directory and is
// applied with `npm run db:migrate`. Provision a new/empty database by running
// that command before starting the app.
//
// Do not reintroduce CREATE TABLE / ALTER TABLE here — ad-hoc schema mutation in
// application code is what caused db.ts and production to silently diverge.
// ---------------------------------------------------------------------------

export type MarkerRow = {
  id: number
  title: string
  creator_id: number
  creator_name: string
  channel_url: string | null
  video_url: string | null
  description: string | null
  latitude: number
  longitude: number
  city: string | null
  district: string | null
  country: string | null
  video_published_at: string | null
  screenshot_url: string | null
  summary: string | null
  location_id: string | null
  location_name: string | null
  location_type: string | null
  parent_location_id: string | null
  parent_location_name: string | null
  timestamp: string | null
  created_at: string
}

const connectionKeys = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NO_SSL",
]

let pool: Pool | null = null

function getConnectionString() {
  for (const key of connectionKeys) {
    const value = process.env[key]
    if (value) return value
  }
  throw new Error(
    "Database connection string is not configured. Set DATABASE_URL (or POSTGRES_URL) in your environment.",
  )
}

export function getPool() {
  if (!pool) {
    const connectionString = getConnectionString()
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

type QueryParam =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: QueryParam[],
) {
  const result = await getPool().query<T>(text, params)
  return result
}

// A query function bound to a single connection — used inside transactions so
// that BEGIN/COMMIT/ROLLBACK and all statements run on the same client. The
// top-level `query()` above grabs an arbitrary pooled connection per call and
// must NOT be used for multi-statement transactions.
export type Queryer = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: QueryParam[],
) => Promise<QueryResult<T>>

/**
 * Run `fn` inside a single transaction. Commits on success, rolls back on any
 * thrown error, and always releases the connection back to the pool.
 */
export async function withTransaction<T>(
  fn: (q: Queryer) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect()
  const q: Queryer = (text, params) => client.query(text, params)
  try {
    await client.query("BEGIN")
    const result = await fn(q)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export function mapMarkerRow(row: MarkerRow) {
  return {
    id: row.id,
    title: row.title,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    channelUrl: row.channel_url,
    videoUrl: row.video_url,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    city: row.city,
    district: row.district,
    country: row.country,
    videoPublishedAt: row.video_published_at,
    screenshotUrl: row.screenshot_url,
    summary: row.summary,
    locationId: row.location_id,
    locationName: row.location_name,
    locationType: row.location_type as 'city' | 'landmark' | null,
    parentLocationId: row.parent_location_id,
    parentLocationName: row.parent_location_name,
    timestamp: row.timestamp,
    createdAt: row.created_at,
  }
}
