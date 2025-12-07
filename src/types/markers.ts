export type Marker = {
  id: number
  title: string
  creator: string
  channelUrl?: string | null
  videoUrl?: string | null
  description?: string | null
  latitude: number
  longitude: number
  videoPublishedAt?: string | null
  createdAt?: string
}

export type MarkerInput = Omit<Marker, "id" | "createdAt">
