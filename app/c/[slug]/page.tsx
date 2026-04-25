import { getCommunityBySlug, listCommunities } from '@/lib/communities'
import { redirect } from 'next/navigation'
import MapPage from '@/app/MapPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) return {}
  return {
    title: `${community.name} | geographic.community`,
    description: community.description ?? `Learn about ${community.name} and how to get involved.`,
    openGraph: {
      title: community.name,
      description: community.description ?? undefined,
    },
  }
}

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) redirect('/all?notFound=1')

  const communities = await listCommunities()
  return <MapPage initialCommunities={communities} initialSelectedCommunity={community} />
}
