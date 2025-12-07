export type Marker = {
  id: number
  title: string
  creator: string
  channelUrl?: string | null
  videoUrl?: string | null
  description?: string | null
  latitude: number
  longitude: number
  city?: string | null
  videoPublishedAt?: string | null
  createdAt?: string
}

export type MarkerInput = Omit<Marker, "id" | "createdAt">

export type VideoGroup = {
  videoUrl: string
  title: string
  creator: string
  channelUrl?: string | null
  videoPublishedAt?: string | null
  locationCount: number
  locations: Marker[]
}

export type LocationEdit = {
  id: number
  latitude: number
  longitude: number
  description?: string
  city?: string
}

export type BatchUpdatePayload = {
  videoUrl: string
  updates: LocationEdit[]
}
