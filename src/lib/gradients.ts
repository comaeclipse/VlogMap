// Generate a consistent gradient for each creator
export function getCreatorGradient(creator: string): string {
  // Simple hash function to generate a number from the creator name
  let hash = 0
  for (let i = 0; i < creator.length; i++) {
    hash = creator.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Generate two distinct hues for the gradient
  const hue1 = Math.abs(hash % 360)
  const hue2 = (hue1 + 120) % 360 // 120 degrees apart for good contrast

  // Use vibrant colors with good saturation and lightness
  const color1 = `hsl(${hue1}, 75%, 60%)`
  const color2 = `hsl(${hue2}, 75%, 60%)`

  return `linear-gradient(135deg, ${color1}, ${color2})`
}
