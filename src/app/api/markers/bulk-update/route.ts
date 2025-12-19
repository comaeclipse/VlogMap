import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { query } from "@/lib/db"

const bulkUpdateSchema = z.object({
  markerIds: z.array(z.number().int().positive()).min(1),
  updates: z.object({
    type: z.enum(["city", "landmark"]).nullable().optional(),
    parentCityId: z.number().int().positive().nullable().optional(),
  }),
})

export async function PUT(request: NextRequest) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    const body = await request.json()
    const { markerIds, updates } = bulkUpdateSchema.parse(body)

    // Validate parentCityId if provided
    if (updates.parentCityId !== undefined && updates.parentCityId !== null) {
      const { rows: parentRows } = await query<{ id: number; type: string | null }>(
        `SELECT id, type FROM explorer_markers WHERE id = $1`,
        [updates.parentCityId]
      )

      if (parentRows.length === 0) {
        return NextResponse.json(
          { error: "Parent city marker not found" },
          { status: 400 }
        )
      }

      if (parentRows[0].type !== "city") {
        return NextResponse.json(
          { error: "Parent marker must be of type 'city'" },
          { status: 400 }
        )
      }

      // Check that none of the markers being updated is the parent itself
      if (markerIds.includes(updates.parentCityId)) {
        return NextResponse.json(
          { error: "A marker cannot be its own parent" },
          { status: 400 }
        )
      }
    }

    // Build the update query dynamically
    const setClauses: string[] = []
    const values: (string | number | null)[] = []
    let paramIndex = 1

    if (updates.type !== undefined) {
      setClauses.push(`type = $${paramIndex}`)
      values.push(updates.type)
      paramIndex++
    }

    if (updates.parentCityId !== undefined) {
      setClauses.push(`parent_city_id = $${paramIndex}`)
      values.push(updates.parentCityId)
      paramIndex++
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      )
    }

    // Add the marker IDs as the last parameter
    const idPlaceholders = markerIds.map((_, i) => `$${paramIndex + i}`).join(", ")
    values.push(...markerIds)

    const updateQuery = `
      UPDATE explorer_markers
      SET ${setClauses.join(", ")}
      WHERE id IN (${idPlaceholders})
      RETURNING id
    `

    const { rows } = await query<{ id: number }>(updateQuery, values)

    // If changing type away from 'city', orphan any children
    if (updates.type !== undefined && updates.type !== "city") {
      // Build placeholders for the marker IDs
      const orphanPlaceholders = markerIds.map((_, i) => `$${i + 1}`).join(", ")
      await query(
        `UPDATE explorer_markers
         SET parent_city_id = NULL
         WHERE parent_city_id IN (${orphanPlaceholders})`,
        markerIds
      )
    }

    return NextResponse.json({
      success: true,
      updatedCount: rows.length,
      updatedIds: rows.map((r) => r.id),
    })
  } catch (error) {
    console.error("Failed to bulk update markers", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Unable to update markers" },
      { status: 500 }
    )
  }
}
