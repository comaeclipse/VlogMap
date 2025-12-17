import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"

type GeocodeResult = {
  city: string | null
  district: string | null
  country: string | null
}

async function geocodeLocation(
  latitude: number,
  longitude: number,
): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured")
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.searchParams.set("latlng", `${latitude},${longitude}`)
  url.searchParams.set("key", apiKey)

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Geocode failed with status ${res.status}`)
  }

  const data = await res.json()
  const result = data?.results?.[0]
  const components: Array<{ long_name: string; types: string[] }> =
    result?.address_components || []

  // Extract city
  const city =
    components.find((c) => c.types.includes("locality"))?.long_name ||
    components.find((c) => c.types.includes("postal_town"))?.long_name ||
    components.find((c) => c.types.includes("administrative_area_level_2"))
      ?.long_name ||
    null

  // Extract district/state
  const district =
    components.find((c) => c.types.includes("administrative_area_level_1"))
      ?.long_name || null

  // Extract country
  const country =
    components.find((c) => c.types.includes("country"))?.long_name || null

  return { city, district, country }
}

export async function POST(request: Request) {
  // Require admin authentication
  const authResult = await requireAdmin(request)
  if (authResult) return authResult

  try {
    // Find all locations with missing country data
    const { rows: locationsToUpdate } = await query<{
      id: string
      latitude: number
      longitude: number
      city: string | null
      district: string | null
      country: string | null
    }>(
      `SELECT id, latitude, longitude, city, district, country 
       FROM locations 
       WHERE country IS NULL 
       ORDER BY id`,
    )

    const results = {
      total: locationsToUpdate.length,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    }

    console.log(
      `Starting backfill for ${locationsToUpdate.length} locations...`,
    )

    // Process each location with a small delay to avoid rate limits
    for (const location of locationsToUpdate) {
      try {
        // Get geocode data
        const geodata = await geocodeLocation(
          location.latitude,
          location.longitude,
        )

        // Update the location
        await query(
          `UPDATE locations 
           SET city = COALESCE($1, city),
               district = COALESCE($2, district),
               country = COALESCE($3, country),
               updated_at = NOW()
           WHERE id = $4`,
          [geodata.city, geodata.district, geodata.country, location.id],
        )

        results.updated++
        console.log(
          `✓ Updated ${location.id}: ${geodata.city}, ${geodata.country}`,
        )

        // Small delay to avoid hitting rate limits (adjust as needed)
        // Google Maps API free tier: 40,000 requests/month
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        results.failed++
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        results.errors.push({ id: location.id, error: errorMsg })
        console.error(`✗ Failed to update ${location.id}:`, errorMsg)
      }
    }

    console.log(
      `Backfill complete: ${results.updated} updated, ${results.failed} failed`,
    )

    return NextResponse.json(results)
  } catch (error) {
    console.error("Backfill failed:", error)
    return NextResponse.json(
      {
        error: "Failed to backfill location data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

