import { NextResponse } from "next/server"

import { getMapMarkers } from "@/lib/markers-data"

// Slim, cacheable marker feed for the homepage map. Marker data is admin-edited
// and changes rarely, so we let the CDN serve it for a short window and
// revalidate in the background.
export async function GET() {
  try {
    const markers = await getMapMarkers()
    return NextResponse.json(markers, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      },
    })
  } catch (error) {
    console.error("Failed to fetch map markers", error)
    return NextResponse.json(
      { error: "Unable to load markers. Check database connectivity." },
      { status: 500 },
    )
  }
}
