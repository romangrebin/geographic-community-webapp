import { listCommunities } from '@/lib/communities'
import MapPage from '@/app/MapPage'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Register a community | geographic.community',
}

export default async function RegisterPage() {
  const communities = await listCommunities()
  return <MapPage initialCommunities={communities} initialMode="draw" />
}
