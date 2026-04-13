import { NextRequest, NextResponse } from 'next/server'
import { getCommunity } from '@/lib/communities'
import { checkOrigin } from '@/lib/validation'
import { getUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const authUser = process.env.NEXT_PUBLIC_SUPABASE_URL ? await getUser(req) : null
  if (!authUser) {
    return NextResponse.json({ error: 'Sign in to claim a community.' }, { status: 401 })
  }

  const { id } = await params
  const community = await getCommunity(id)
  if (!community) {
    return NextResponse.json({ error: 'Community not found' }, { status: 404 })
  }

  if (community.claimedBy) {
    return NextResponse.json(
      { error: 'This community is already claimed.' },
      { status: 409 }
    )
  }

  // Set claimed_by and claimed_at directly via Supabase.
  // Use service role key to bypass RLS — ownership was verified above.
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const updates: Record<string, unknown> = {
    claimed_by: authUser.id,
    claimed_at: new Date().toISOString(),
  }
  // Auto-populate contact email from the claimer's account if not already set
  if (!community.email && authUser.email) {
    updates.email = authUser.email
  }

  const { data, error } = await client
    .from('communities')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Map DB row to Community shape
  const updated = {
    ...community,
    claimedBy: data.claimed_by as string,
    claimedAt: data.claimed_at as string,
    email: (data.email as string | null) ?? community.email,
  }

  return NextResponse.json(updated)
}
