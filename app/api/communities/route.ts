import { NextRequest, NextResponse } from 'next/server'
import { createCommunity } from '@/lib/communities'
import type { CommunityInput } from '@/lib/types'

export async function POST(req: NextRequest) {
  let input: CommunityInput
  try {
    input = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!input.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!input.geojson) {
    return NextResponse.json({ error: 'Boundary (geojson) is required' }, { status: 400 })
  }
  if (!input.website && !input.email) {
    return NextResponse.json({ error: 'At least one of website or email is required' }, { status: 400 })
  }

  try {
    const community = await createCommunity(input)
    return NextResponse.json(community, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error'
    // Detect duplicate name via unique constraint
    if (message.includes('duplicate') || message.includes('unique')) {
      return NextResponse.json({ error: 'A community with this name already exists.' }, { status: 409 })
    }
    console.error(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
