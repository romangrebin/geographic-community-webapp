import { booleanPointInPolygon, point } from '@turf/turf'
import type { Community, BBox } from './types'
import { listCommunities } from './communities'

export async function getCommunitiesAtPoint(lat: number, lng: number): Promise<Community[]> {
  const communities = await listCommunities()
  const pt = point([lng, lat])
  return communities.filter((c) => booleanPointInPolygon(pt, c.geojson))
}

export async function getCommunitiesInViewport(_bbox: BBox): Promise<Community[]> {
  // Tier 1: not called anywhere. Implement in Tier 2 with PostGIS ST_Intersects.
  throw new Error('not implemented')
}
