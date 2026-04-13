import { NextRequest, NextResponse } from 'next/server'
import { createCommunity } from '@/lib/communities'
import { validateCommunityInput, checkOrigin } from '@/lib/validation'
import { getUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateCommunityInput(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // If the user is signed in, auto-claim the community
  const authUser = process.env.NEXT_PUBLIC_SUPABASE_URL ? await getUser(req) : null

  try {
    const community = await createCommunity(result.sanitized, {
      claimedBy: authUser?.id,
    })
    return NextResponse.json(community, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error'
    if (message.includes('duplicate') || message.includes('unique')) {
      return NextResponse.json({ error: 'A community with this name already exists.' }, { status: 409 })
    }
    console.error(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
