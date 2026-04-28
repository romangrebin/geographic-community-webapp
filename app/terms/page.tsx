import { listCommunities } from '@/lib/communities'
import MapPage from '@/app/MapPage'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Terms | geographic.community',
}

export default async function TermsPage() {
  const communities = await listCommunities()
  return <MapPage initialCommunities={communities} initialPanel="terms" />
}
