import { NextRequest, NextResponse } from "next/server"

const headerKeys = ["x-admin-secret", "authorization"]

export function requireAdmin(request: NextRequest) {
  const expected = process.env.ADMIN_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_SECRET is not configured" },
      { status: 500 },
    )
  }

  const provided = headerKeys
    .map((key) => request.headers.get(key))
    .filter(Boolean)
    .map((value) => {
      if (!value) return null
      if (value.toLowerCase().startsWith("bearer ")) {
        return value.slice(7)
      }
      return value
    })
    .find(Boolean)

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
