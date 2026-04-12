import { listCommunities } from '@/lib/communities'
import MapPage from './MapPage'

export const dynamic = 'force-dynamic'

type SearchParams = { lat?: string; lng?: string }

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [communities, params] = await Promise.all([listCommunities(), searchParams])
  const initialLat = params.lat ? parseFloat(params.lat) : null
  const initialLng = params.lng ? parseFloat(params.lng) : null
  const validCoords =
    initialLat != null && initialLng != null && isFinite(initialLat) && isFinite(initialLng)
  return (
    <MapPage
      initialCommunities={communities}
      initialLat={validCoords ? initialLat : null}
      initialLng={validCoords ? initialLng : null}
    />
  )
}
