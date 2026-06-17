import { HomeMap } from "@/components/home-map"
import { getMapMarkers } from "@/lib/markers-data"

// Pre-render the page with marker data baked into the initial HTML (so pins show
// on first paint instead of after a client fetch), and regenerate it at most
// every 30s. SWR still revalidates on the client for fresher data between builds.
export const revalidate = 30

export default async function Home() {
  let initialMarkers: Awaited<ReturnType<typeof getMapMarkers>> = []
  try {
    initialMarkers = await getMapMarkers()
  } catch (error) {
    // Fall back to an empty set; the client SWR fetch will surface any error.
    console.error("Failed to load initial markers", error)
  }

  return <HomeMap initialMarkers={initialMarkers} />
}
