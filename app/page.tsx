import { listCommunities } from '@/lib/communities'
import MapPage from './MapPage'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const communities = await listCommunities()
  return <MapPage initialCommunities={communities} />
}
