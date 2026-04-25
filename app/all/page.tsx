import { listCommunities } from '@/lib/communities'
import MapPage from '@/app/MapPage'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'All Communities | geographic.community',
}

export default async function AllCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ notFound?: string }>
}) {
  const { notFound } = await searchParams
  const communities = await listCommunities()
  return (
    <MapPage
      initialCommunities={communities}
      initialPanel="browse"
      flashMessage={notFound ? "That community couldn't be found — it may have been removed or the link may be outdated." : undefined}
    />
  )
}
