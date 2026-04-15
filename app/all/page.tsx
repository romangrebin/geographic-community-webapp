import { listCommunities } from '@/lib/communities'
import MapPage from '@/app/MapPage'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'All Communities | geographic.community',
}

export default async function AllCommunitiesPage() {
  const communities = await listCommunities()
  return <MapPage initialCommunities={communities} initialPanel="browse" />
}
