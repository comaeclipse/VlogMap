/**
 * Best-effort in-memory login rate limiter.
 *
 * Tracks failed login attempts per IP. After MAX_ATTEMPTS failures within a
 * rolling window, the IP is blocked for BAN_MS. State lives in this module's
 * memory, so on serverless it is per-instance and resets on deploy/scale — it
 * is a speed bump against brute force, not an airtight guarantee.
 */

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // failures counted within this rolling window
const BAN_MS = 15 * 60 * 1000 // how long an IP is blocked once the limit is hit

type Entry = {
  count: number
  windowResetAt: number
  bannedUntil?: number
}

const attempts = new Map<string, Entry>()

let lastPrune = 0
const PRUNE_INTERVAL_MS = 60 * 1000

// Drop expired entries so a flood of distinct IPs can't grow the map forever.
function prune(now: number) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return
  lastPrune = now
  for (const [ip, entry] of attempts) {
    const banActive = entry.bannedUntil && entry.bannedUntil > now
    const windowActive = entry.windowResetAt > now
    if (!banActive && !windowActive) attempts.delete(ip)
  }
}

/** Extract the client IP from Vercel's forwarding headers. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip")?.trim() || "unknown"
}

/** Returns whether the IP is currently blocked, and for how many seconds. */
export function checkRateLimit(ip: string): {
  blocked: boolean
  retryAfterSec: number
} {
  const now = Date.now()
  prune(now)
  const entry = attempts.get(ip)
  if (entry?.bannedUntil && entry.bannedUntil > now) {
    return { blocked: true, retryAfterSec: Math.ceil((entry.bannedUntil - now) / 1000) }
  }
  return { blocked: false, retryAfterSec: 0 }
}

/**
 * Record a failed attempt for the IP. Returns whether this failure tripped the
 * ban, the seconds remaining if banned, and how many attempts remain otherwise.
 */
export function recordFailedAttempt(ip: string): {
  banned: boolean
  retryAfterSec: number
  attemptsRemaining: number
} {
  const now = Date.now()
  let entry = attempts.get(ip)

  // Start a fresh window if there's no entry or the previous window expired.
  if (!entry || entry.windowResetAt <= now) {
    entry = { count: 0, windowResetAt: now + WINDOW_MS }
  }

  entry.count += 1

  if (entry.count >= MAX_ATTEMPTS) {
    entry.bannedUntil = now + BAN_MS
    attempts.set(ip, entry)
    return { banned: true, retryAfterSec: Math.ceil(BAN_MS / 1000), attemptsRemaining: 0 }
  }

  attempts.set(ip, entry)
  return {
    banned: false,
    retryAfterSec: 0,
    attemptsRemaining: MAX_ATTEMPTS - entry.count,
  }
}

/** Clear all recorded attempts for an IP (call on successful login). */
export function resetAttempts(ip: string): void {
  attempts.delete(ip)
}
