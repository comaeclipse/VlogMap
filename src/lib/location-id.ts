/**
 * Location ID generation utilities
 * Generates unique 8-character alphanumeric IDs for locations
 */

import { randomInt } from "crypto"

const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789"
const ID_LENGTH = 8

/**
 * Generate a random 8-character alphanumeric ID
 * Uses crypto.randomInt for cryptographically secure random generation
 */
export function generateLocationId(): string {
  let id = ""
  for (let i = 0; i < ID_LENGTH; i++) {
    const randomIndex = randomInt(0, CHARSET.length)
    id += CHARSET[randomIndex]
  }
  return id
}

/**
 * Generate a unique location ID that doesn't exist in the database
 * Retries up to 5 times if collision occurs (extremely unlikely)
 */
export async function generateUniqueLocationId(
  checkExists: (id: string) => Promise<boolean>,
): Promise<string> {
  const maxRetries = 5

  for (let i = 0; i < maxRetries; i++) {
    const id = generateLocationId()
    const exists = await checkExists(id)
    if (!exists) {
      return id
    }
  }

  throw new Error(
    "Failed to generate unique location ID after multiple attempts",
  )
}
