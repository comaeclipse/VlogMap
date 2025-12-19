import { NextResponse, type NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY environment variable is not set")
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY is not configured" },
      { status: 500 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const { latitude, longitude } = body || {}
  if (
    typeof latitude !== "number" ||
    Number.isNaN(latitude) ||
    typeof longitude !== "number" ||
    Number.isNaN(longitude)
  ) {
    console.error("Invalid coordinates received:", { latitude, longitude })
    return NextResponse.json({ error: `Invalid coordinates: lat=${latitude}, lng=${longitude}` }, { status: 400 })
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.searchParams.set("latlng", `${latitude},${longitude}`)
  url.searchParams.set("key", apiKey)

  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      const errorText = await res.text()
      console.error("Google Maps API error:", res.status, errorText)
      return NextResponse.json({ error: `Geocode lookup failed: ${res.status}` }, { status: 400 })
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

    return NextResponse.json({ city, district, country })
  } catch (error) {
    console.error("Geocode failed", error)
    return NextResponse.json({ error: "Geocode failed" }, { status: 500 })
  }
}


