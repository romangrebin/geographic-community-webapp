import { NextRequest, NextResponse } from 'next/server'
import { deleteCommunity, getCommunity, updateCommunity } from '@/lib/communities'
import { validateCommunityUpdate, checkOrigin } from '@/lib/validation'
import { getUser } from '@/lib/auth'

async function checkOwnership(req: NextRequest, communityId: string): Promise<
  | { allowed: true }
  | { allowed: false; response: NextResponse }
> {
  const community = await getCommunity(communityId)
  if (!community) {
    return {
      allowed: false,
      response: NextResponse.json({ error: 'Community not found' }, { status: 404 }),
    }
  }

  // Unclaimed communities are open to anyone
  if (!community.claimedBy) {
    return { allowed: true }
  }

  // Claimed: require the matching signed-in user
  const authUser = process.env.NEXT_PUBLIC_SUPABASE_URL ? await getUser(req) : null
  if (!authUser || authUser.id !== community.claimedBy) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Only the steward can edit this community.' },
        { status: 403 }
      ),
    }
  }

  return { allowed: true }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const ownershipCheck = await checkOwnership(req, id)
  if (!ownershipCheck.allowed) return ownershipCheck.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateCommunityUpdate(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // If the update would remove both contact methods, reject
  const existing = await getCommunity(id)
  if (!existing) {
    return NextResponse.json({ error: 'Community not found' }, { status: 404 })
  }
  const merged = { ...existing, ...result.sanitized }
  if (!merged.website && !merged.email) {
    return NextResponse.json({ error: 'At least one of website or email is required' }, { status: 400 })
  }

  try {
    const community = await updateCommunity(id, result.sanitized)
    return NextResponse.json(community)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    if (message === 'Community not found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const ownershipCheck = await checkOwnership(req, id)
  if (!ownershipCheck.allowed) return ownershipCheck.response

  try {
    await deleteCommunity(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    if (message === 'Community not found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
