import type { Metadata } from "next"

import { getCreatorStats } from "@/lib/creators-data"
import type { CreatorStats } from "@/types/creators"
import { CreatorsView } from "@/components/creators-view"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Creators | VlogMap",
  description: "Browse the YouTubers mapped on VlogMap and explore their filming locations.",
}

export default async function CreatorsPage() {
  let creators: CreatorStats[] = []
  try {
    creators = await getCreatorStats()
  } catch (error) {
    console.error("Failed to load creators", error)
  }

  return <CreatorsView creators={creators} />
}
