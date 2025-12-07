import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const expected = process.env.ADMIN_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_SECRET is not configured" },
      { status: 500 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const password = body?.password

  if (!password || password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set("vlogmap-session", expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })

  return NextResponse.json({ success: true })
}

