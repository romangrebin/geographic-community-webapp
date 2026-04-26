import type { Feature, Polygon, MultiPolygon } from 'geojson'

export type CommunityCategory = string

export type Community = {
  id: string
  name: string
  slug: string
  description: string | null
  category: CommunityCategory
  website: string | null
  email: string | null
  geojson: Feature<Polygon | MultiPolygon>
  emailPublic: boolean
  createdAt: string
  updatedAt: string | null
  claimedBy: string | null
  claimedAt: string | null
}

export type CommunityInput = {
  name: string
  description: string | null
  category: CommunityCategory
  website: string | null
  email: string | null
  emailPublic: boolean
  geojson: Feature<Polygon | MultiPolygon>
}

export type BBox = {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}
