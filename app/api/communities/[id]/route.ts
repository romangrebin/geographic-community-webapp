import { NextResponse } from 'next/server'
import { deleteCommunity } from '@/lib/communities'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
