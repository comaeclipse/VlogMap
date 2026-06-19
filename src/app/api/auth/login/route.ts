import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

import {
  checkRateLimit,
  getClientIp,
  recordFailedAttempt,
  resetAttempts,
} from "@/lib/rate-limit"

function tooManyAttempts(retryAfterSec: number) {
  const minutes = Math.ceil(retryAfterSec / 60)
  return NextResponse.json(
    {
      error: `Too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  )
}

export async function POST(request: NextRequest) {
  const expected = process.env.ADMIN_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_SECRET is not configured" },
      { status: 500 },
    )
  }

  const ip = getClientIp(request.headers)

  // Reject early if this IP is currently blocked.
  const limit = checkRateLimit(ip)
  if (limit.blocked) {
    return tooManyAttempts(limit.retryAfterSec)
  }

  const body = await request.json().catch(() => ({}))
  const password = body?.password

  if (!password || password !== expected) {
    const result = recordFailedAttempt(ip)
    if (result.banned) {
      return tooManyAttempts(result.retryAfterSec)
    }
    return NextResponse.json(
      {
        error: `Invalid password. ${result.attemptsRemaining} attempt${result.attemptsRemaining !== 1 ? "s" : ""} remaining.`,
      },
      { status: 401 },
    )
  }

  // Successful login — clear any recorded failures for this IP.
  resetAttempts(ip)

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

