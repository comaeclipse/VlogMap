import { NextResponse, type NextRequest } from "next/server"
import { query } from "@/lib/db"
import { generateUniqueLocationId } from "@/lib/location-id"
import { requireAdmin } from "@/lib/auth"

/**
 * Fix orphan landmarks by assigning them parent cities
 * According to ARCHITECTURE.md: "All landmarks must have parent city"
 */
export async function POST(request: NextRequest) {
  // Require admin authentication
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    console.log("Starting orphan landmark fix...")

    // Fetch all orphan landmarks (type='landmark' AND parent_location_id IS NULL)
    const { rows: orphans } = await query<{
      id: string
      name: string
      city: string | null
      district: string | null
      country: string | null
      latitude: number
      longitude: number
    }>(
      `SELECT id, name, city, district, country, latitude, longitude
       FROM locations
       WHERE type = 'landmark' AND parent_location_id IS NULL
       ORDER BY city, name`,
    )

    console.log(`Found ${orphans.length} orphan landmarks`)

    let fixed = 0
    let failed = 0
    let citiesCreated = 0
    const errors: Array<{ landmarkId: string; error: string }> = []

    for (const landmark of orphans) {
      try {
        // Skip if no city information
        if (!landmark.city && !landmark.country) {
          console.log(`⚠ Skipping ${landmark.id} (${landmark.name}) - no city/country data`)
          failed++
          errors.push({
            landmarkId: landmark.id,
            error: "No city or country information available",
          })
          continue
        }

        // Try to find existing city location with matching city and country
        const { rows: cityRows } = await query<{ id: string }>(
          `SELECT id FROM locations 
           WHERE type = 'city' 
           AND city = $1 
           AND country = $2
           LIMIT 1`,
          [landmark.city, landmark.country],
        )

        let cityLocationId: string

        if (cityRows.length > 0) {
          // Use existing city
          cityLocationId = cityRows[0].id
          console.log(`✓ Found existing city ${cityLocationId} for ${landmark.city}, ${landmark.country}`)
        } else {
          // Create new city location
          const checkExists = async (id: string) => {
            const { rows } = await query<{ exists: boolean }>(
              "SELECT EXISTS(SELECT 1 FROM locations WHERE id = $1) as exists",
              [id],
            )
            return rows[0].exists
          }

          cityLocationId = `city-${await generateUniqueLocationId(checkExists)}`

          await query(
            `INSERT INTO locations (id, name, type, latitude, longitude, city, district, country, parent_location_id)
             VALUES ($1, $2, 'city', $3, $4, $5, $6, $7, NULL)`,
            [
              cityLocationId,
              landmark.city || landmark.country || "Unknown City",
              landmark.latitude,
              landmark.longitude,
              landmark.city,
              landmark.district,
              landmark.country,
            ],
          )

          citiesCreated++
          console.log(`+ Created new city ${cityLocationId} for ${landmark.city}, ${landmark.country}`)
        }

        // Update landmark's parent_location_id
        await query(
          `UPDATE locations SET parent_location_id = $1 WHERE id = $2`,
          [cityLocationId, landmark.id],
        )

        console.log(`✓ Linked landmark ${landmark.id} (${landmark.name}) to city ${cityLocationId}`)
        fixed++
      } catch (error) {
        console.error(`✗ Failed to fix landmark ${landmark.id}:`, error)
        failed++
        errors.push({
          landmarkId: landmark.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Verify no orphans remain
    const { rows: remainingOrphans } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM locations WHERE type = 'landmark' AND parent_location_id IS NULL`,
    )

    return NextResponse.json({
      success: true,
      message: "Orphan landmark fix completed",
      stats: {
        totalOrphans: orphans.length,
        fixed,
        failed,
        citiesCreated,
        remainingOrphans: parseInt(remainingOrphans[0]?.count || "0"),
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Fix orphans failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Fix orphans failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

