import { NextResponse } from "next/server"
import { getCreatorStats } from "@/lib/creators-data"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const creators = await getCreatorStats()
    return NextResponse.json(creators)
  } catch (err: unknown) {
    console.error("Failed to fetch creator stats:", err)
    return NextResponse.json(
      { error: "Failed to fetch creator stats" },
      { status: 500 },
    )
  }
}
