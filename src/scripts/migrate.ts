/**
 * Database migration runner.
 *
 * Applies every *.sql file in the project-root `migrations/` directory, in
 * filename order, exactly once. Applied migrations are recorded in the
 * `schema_migrations` table so re-running is safe and idempotent.
 *
 * Run with: npm run db:migrate
 *
 * This is the ONLY supported way to change the database schema. Add a new
 * numbered file (e.g. migrations/0002_drop_dead_columns.sql) and run this.
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { getPool } from "../lib/db"

const CONNECTION_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NO_SSL",
]

/**
 * Minimal .env.local loader — tsx does not auto-load it. Only fills in the
 * connection-string keys if none are already present in the environment.
 */
function loadEnvLocal() {
  if (CONNECTION_KEYS.some((key) => process.env[key])) return
  try {
    const contents = readFileSync(join(process.cwd(), ".env.local"), "utf8")
    for (const line of contents.split("\n")) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!match) continue
      const [, key, rawValue] = match
      const value = rawValue.replace(/^["']|["']$/g, "")
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}

async function main() {
  loadEnvLocal()

  const pool = getPool()
  const client = await pool.connect()

  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version    TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    )

    const { rows } = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations",
    )
    const applied = new Set(rows.map((r) => r.version))

    const dir = join(process.cwd(), "migrations")
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()

    let count = 0
    for (const file of files) {
      const version = file.replace(/\.sql$/, "")
      if (applied.has(version)) {
        console.log(`= ${file} (already applied)`)
        continue
      }

      const sql = readFileSync(join(dir, file), "utf8")
      console.log(`→ applying ${file} ...`)
      try {
        await client.query("BEGIN")
        await client.query(sql)
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [version],
        )
        await client.query("COMMIT")
        console.log(`✓ applied ${file}`)
        count++
      } catch (err) {
        await client.query("ROLLBACK")
        console.error(`✗ failed ${file}:`, err)
        throw err
      }
    }

    console.log(`\nDone. ${count} migration(s) applied, ${applied.size} already current.`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error("Migration run failed:", err)
  process.exit(1)
})
