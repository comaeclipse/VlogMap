import { Pool } from "pg"
import type { QueryResultRow } from "pg"

export type MarkerRow = {
  id: number
  title: string
  creator: string
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
  type: string | null
  parent_city_id: number | null
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
let schemaReady: Promise<void> | null = null

function getConnectionString() {
  for (const key of connectionKeys) {
    const value = process.env[key]
    if (value) return value
  }
  throw new Error(
    "Database connection string is not configured. Set DATABASE_URL (or POSTGRES_URL) in your environment.",
  )
}

function getPool() {
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

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
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
            city TEXT,
            video_published_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `)
        await getPool().query(
          `ALTER TABLE explorer_markers ADD COLUMN IF NOT EXISTS video_published_at TIMESTAMPTZ`,
        )
        await getPool().query(
          `ALTER TABLE explorer_markers ADD COLUMN IF NOT EXISTS city TEXT`,
        )
        await getPool().query(
          `ALTER TABLE explorer_markers ADD COLUMN IF NOT EXISTS screenshot_url TEXT`,
        )
        await getPool().query(
          `ALTER TABLE explorer_markers ADD COLUMN IF NOT EXISTS summary TEXT`,
        )

        // Create locations table
        await getPool().query(`
          CREATE TABLE IF NOT EXISTS locations (
            id VARCHAR(8) PRIMARY KEY,
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            city TEXT,
            name TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `)

        // Create index on location coordinates
        await getPool().query(`
          CREATE INDEX IF NOT EXISTS idx_locations_coords
          ON locations (latitude, longitude)
        `)

        // Add location_id column to explorer_markers
        await getPool().query(`
          ALTER TABLE explorer_markers
          ADD COLUMN IF NOT EXISTS location_id VARCHAR(8)
        `)

        // Add foreign key constraint (will fail silently if already exists)
        try {
          await getPool().query(`
            ALTER TABLE explorer_markers
            ADD CONSTRAINT fk_location_id
            FOREIGN KEY (location_id)
            REFERENCES locations(id)
            ON DELETE SET NULL
          `)
        } catch (fkErr: unknown) {
          // Constraint already exists, ignore
        }

        // Create index on location_id for faster joins
        await getPool().query(`
          CREATE INDEX IF NOT EXISTS idx_markers_location_id
          ON explorer_markers (location_id)
        `)

        // Add district and country columns to locations table
        await getPool().query(`
          ALTER TABLE locations
          ADD COLUMN IF NOT EXISTS district TEXT
        `)
        await getPool().query(`
          ALTER TABLE locations
          ADD COLUMN IF NOT EXISTS country TEXT
        `)

        // Add district and country columns to explorer_markers table
        await getPool().query(`
          ALTER TABLE explorer_markers
          ADD COLUMN IF NOT EXISTS district TEXT
        `)
        await getPool().query(`
          ALTER TABLE explorer_markers
          ADD COLUMN IF NOT EXISTS country TEXT
        `)

        // Add type and parent_city_id columns to explorer_markers table
        await getPool().query(`
          ALTER TABLE explorer_markers
          ADD COLUMN IF NOT EXISTS type VARCHAR(20)
        `)
        await getPool().query(`
          ALTER TABLE explorer_markers
          ADD COLUMN IF NOT EXISTS parent_city_id INTEGER
        `)

        // Add foreign key constraint for parent_city_id (will fail silently if already exists)
        try {
          await getPool().query(`
            ALTER TABLE explorer_markers
            ADD CONSTRAINT fk_parent_city_id
            FOREIGN KEY (parent_city_id)
            REFERENCES explorer_markers(id)
            ON DELETE SET NULL
          `)
        } catch (fkErr: unknown) {
          // Constraint already exists, ignore
        }

        // Add type column to locations table
        await getPool().query(`
          ALTER TABLE locations
          ADD COLUMN IF NOT EXISTS type VARCHAR(20)
        `)
      } catch (err: unknown) {
        // Ignore duplicate type error (23505 on pg_type) - table already exists
        const pgErr = err as { code?: string; table?: string }
        if (pgErr.code === "23505" && pgErr.table === "pg_type") {
          return
        }
        throw err
      }
    })()
  }
  return schemaReady
}

type QueryParam = string | number | boolean | null

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: QueryParam[],
) {
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
    city: row.city,
    district: row.district,
    country: row.country,
    videoPublishedAt: row.video_published_at,
    screenshotUrl: row.screenshot_url,
    summary: row.summary,
    locationId: row.location_id,
    type: row.type as 'city' | 'landmark' | null,
    parentCityId: row.parent_city_id,
    createdAt: row.created_at,
  }
}
