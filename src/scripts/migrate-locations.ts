/**
 * One-time migration script to assign location IDs to existing markers
 * Run with: npm run migrate:locations
 */

import { query } from "../lib/db"
import type { MarkerRow } from "../lib/db"
import { assignLocationToMarker } from "../lib/location-matching"

async function migrateExistingMarkers() {
  console.log("Starting location ID migration...")

  try {
    // Fetch all markers without location_id
    const { rows } = await query<MarkerRow>(
      `SELECT id, latitude, longitude, city, location_id
       FROM explorer_markers
       WHERE location_id IS NULL
       ORDER BY created_at ASC`,
    )

    console.log(`Found ${rows.length} markers without location IDs`)

    let assigned = 0
    let failed = 0

    for (const marker of rows) {
      try {
        const locationId = await assignLocationToMarker(
          marker.id,
          marker.latitude,
          marker.longitude,
          marker.city,
        )
        console.log(`✓ Marker ${marker.id} assigned to location ${locationId}`)
        assigned++
      } catch (error) {
        console.error(
          `✗ Failed to assign location to marker ${marker.id}:`,
          error,
        )
        failed++
      }
    }

    console.log("\nMigration complete!")
    console.log(`Successfully assigned: ${assigned}`)
    console.log(`Failed: ${failed}`)

    // Print summary statistics
    const { rows: locationStats } = await query<{
      location_count: string
      avg_markers_per_location: string
    }>(
      `SELECT
         COUNT(DISTINCT location_id) as location_count,
         AVG(marker_count)::numeric(10,2) as avg_markers_per_location
       FROM (
         SELECT location_id, COUNT(*) as marker_count
         FROM explorer_markers
         WHERE location_id IS NOT NULL
         GROUP BY location_id
       ) subquery`,
    )

    console.log(
      `\nTotal locations created: ${locationStats[0].location_count}`,
    )
    console.log(
      `Average markers per location: ${locationStats[0].avg_markers_per_location}`,
    )
  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  }
}

// Run migration
migrateExistingMarkers()
  .then(() => {
    console.log("Exiting...")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
