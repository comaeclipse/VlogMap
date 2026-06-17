import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { mergeLocations, MergeError } from "@/lib/location-matching"

const mergeSchema = z.object({
  targetId: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
})

export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    const body = await request.json()
    const { targetId, sourceIds } = mergeSchema.parse(body)

    const result = await mergeLocations(targetId, sourceIds)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.issues },
        { status: 400 },
      )
    }
    if (error instanceof MergeError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Failed to merge locations", error)
    return NextResponse.json(
      { error: "Unable to merge locations" },
      { status: 500 },
    )
  }
}
