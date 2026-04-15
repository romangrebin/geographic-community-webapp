import { listCommunities } from '@/lib/communities'
import MapPage from '@/app/MapPage'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'About | geographic.community',
}

export default async function AboutPage() {
  const communities = await listCommunities()
  return <MapPage initialCommunities={communities} initialPanel="about" />
}
