import { NextResponse, type NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
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
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.searchParams.set("latlng", `${latitude},${longitude}`)
  url.searchParams.set("key", apiKey)

  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      return NextResponse.json({ error: "Geocode lookup failed" }, { status: 400 })
    }
    const data = await res.json()
    const result = data?.results?.[0]
    const components: Array<{ long_name: string; types: string[] }> =
      result?.address_components || []

    const city =
      components.find((c) => c.types.includes("locality"))?.long_name ||
      components.find((c) => c.types.includes("postal_town"))?.long_name ||
      components.find((c) => c.types.includes("administrative_area_level_2"))?.long_name ||
      null

    return NextResponse.json({ city })
  } catch (error) {
    console.error("Geocode failed", error)
    return NextResponse.json({ error: "Geocode failed" }, { status: 500 })
  }
}


