// Generate a consistent gradient for each creator with high variation
export function getCreatorGradient(creator: string): string {
  // Simple hash function to generate a number from the creator name
  let hash = 0
  for (let i = 0; i < creator.length; i++) {
    hash = creator.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Use hash to pick gradient style
  const absHash = Math.abs(hash)
  const styleIndex = absHash % 8

  // Generate base hue
  const hue1 = absHash % 360

  // Different gradient styles with varied saturation, lightness, and patterns
  switch (styleIndex) {
    case 0: // Bold dual-tone with high contrast
      return `linear-gradient(135deg, hsl(${hue1}, 95%, 50%), hsl(${(hue1 + 180) % 360}, 90%, 45%))`

    case 1: // Vibrant triple gradient
      return `linear-gradient(135deg, hsl(${hue1}, 90%, 55%), hsl(${(hue1 + 90) % 360}, 85%, 60%), hsl(${(hue1 + 180) % 360}, 95%, 50%))`

    case 2: // Deep saturated tones
      return `linear-gradient(135deg, hsl(${hue1}, 100%, 40%), hsl(${(hue1 + 140) % 360}, 95%, 45%))`

    case 3: // Bright complementary
      return `linear-gradient(135deg, hsl(${hue1}, 85%, 65%), hsl(${(hue1 + 160) % 360}, 90%, 55%))`

    case 4: // Neon-like with high saturation
      return `linear-gradient(135deg, hsl(${hue1}, 100%, 55%), hsl(${(hue1 + 120) % 360}, 100%, 60%))`

    case 5: // Rich jewel tones
      return `linear-gradient(135deg, hsl(${hue1}, 80%, 45%), hsl(${(hue1 + 100) % 360}, 85%, 50%))`

    case 6: // Electric triple gradient
      return `linear-gradient(135deg, hsl(${hue1}, 95%, 60%), hsl(${(hue1 + 60) % 360}, 90%, 55%), hsl(${(hue1 + 120) % 360}, 95%, 65%))`

    case 7: // Bold sunset-style
      return `linear-gradient(135deg, hsl(${hue1}, 90%, 50%), hsl(${(hue1 + 45) % 360}, 95%, 55%), hsl(${(hue1 + 90) % 360}, 85%, 60%))`

    default:
      return `linear-gradient(135deg, hsl(${hue1}, 85%, 55%), hsl(${(hue1 + 120) % 360}, 85%, 55%))`
  }
}
