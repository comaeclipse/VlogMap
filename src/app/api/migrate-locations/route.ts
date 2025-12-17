import { NextResponse, type NextRequest } from "next/server"
import { query } from "@/lib/db"
import type { MarkerRow } from "@/lib/db"
import { assignLocationToMarker } from "@/lib/location-matching"
import { requireAdmin } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Require admin authentication
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    console.log("Starting location ID migration...")

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
    const errors: Array<{ markerId: number; error: string }> = []

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
        errors.push({
          markerId: marker.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Get summary statistics
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

    return NextResponse.json({
      success: true,
      message: "Migration completed",
      stats: {
        totalProcessed: rows.length,
        successfullyAssigned: assigned,
        failed,
        totalLocations: locationStats[0]?.location_count || "0",
        avgMarkersPerLocation: locationStats[0]?.avg_markers_per_location || "0",
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Migration failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Migration failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
