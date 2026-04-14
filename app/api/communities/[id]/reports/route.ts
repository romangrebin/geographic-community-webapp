import { NextRequest, NextResponse } from 'next/server'
import { getCommunity } from '@/lib/communities'
import { checkOrigin } from '@/lib/validation'
import { createReport } from '@/lib/reports'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const community = await getCommunity(id)
  if (!community) {
    return NextResponse.json({ error: 'Community not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { reason, reporter_email } = body as Record<string, unknown>

  if (typeof reason !== 'string' || reason.trim().length === 0) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }
  if (reason.trim().length > 2000) {
    return NextResponse.json({ error: 'reason must be 2000 characters or fewer' }, { status: 400 })
  }
  if (reporter_email !== undefined && reporter_email !== null && typeof reporter_email !== 'string') {
    return NextResponse.json({ error: 'reporter_email must be a string' }, { status: 400 })
  }

  try {
    await createReport(
      id,
      reason.trim(),
      typeof reporter_email === 'string' ? reporter_email.trim() || undefined : undefined
    )
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Fire-and-forget ntfy notification — failure doesn't affect the response
  const ntfyUrl = process.env.NTFY_URL
  if (ntfyUrl) {
    const reporterNote = typeof reporter_email === 'string' && reporter_email.trim()
      ? `\nFrom: ${reporter_email.trim()}`
      : ''
    fetch(ntfyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Report: ${community.name}`,
        message: `${(reason as string).trim()}${reporterNote}`,
        priority: 3,
        tags: ['warning'],
      }),
    }).catch((err) => console.error('ntfy notification failed:', err))
  }

  return new NextResponse(null, { status: 201 })
}
