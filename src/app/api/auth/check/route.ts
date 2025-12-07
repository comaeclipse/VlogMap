import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const expected = process.env.ADMIN_SECRET
  if (!expected) {
    return NextResponse.json({ authenticated: false })
  }

  const cookieStore = await cookies()
  const session = cookieStore.get("vlogmap-session")?.value

  return NextResponse.json({ authenticated: session === expected })
}

