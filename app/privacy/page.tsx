import { listCommunities } from '@/lib/communities'
import MapPage from '@/app/MapPage'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Privacy | geographic.community',
}

export default async function PrivacyPage() {
  const communities = await listCommunities()
  return <MapPage initialCommunities={communities} initialPanel="privacy" />
}
