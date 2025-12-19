export type Marker = {
  id: number
  title: string
  creatorId: number
  creatorName: string
  channelUrl?: string | null
  videoUrl?: string | null
  description?: string | null
  latitude: number
  longitude: number
  city?: string | null
  district?: string | null
  country?: string | null
  videoPublishedAt?: string | null
  screenshotUrl?: string | null
  summary?: string | null
  locationId?: string | null
  locationName?: string | null
  type?: 'city' | 'landmark' | null
  parentCityId?: number | null
  parentCityName?: string | null
  timestamp?: string | null
  createdAt?: string
}

export type MarkerInput = Omit<Marker, "id" | "createdAt">

export type VideoGroup = {
  videoUrl: string
  title: string
  creatorName: string
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
  screenshotUrl?: string
  type?: 'city' | 'landmark' | null
  parentCityId?: number | null
  timestamp?: string | null
}

export type BatchUpdatePayload = {
  videoUrl: string
  updates: LocationEdit[]
}

export type NearbyVideo = VideoGroup & {
  distanceKm: number
}

export type Location = {
  id: string
  latitude: number
  longitude: number
  city?: string | null
  district?: string | null
  country?: string | null
  name?: string | null
  type?: 'city' | 'landmark' | null
  createdAt: string
  updatedAt: string
}
