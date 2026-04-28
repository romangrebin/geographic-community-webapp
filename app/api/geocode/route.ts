import { NextRequest, NextResponse } from 'next/server'

// Proxies address-search requests to Nominatim with a proper User-Agent.
// Browsers cannot set User-Agent on fetch, and Nominatim's usage policy
// requires identification (https://operations.osmfoundation.org/policies/nominatim/).
const USER_AGENT = 'geographic.community (https://geographic.community)'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 3) return NextResponse.json([])

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
    })
    if (!res.ok) return NextResponse.json([], { status: 502 })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json([], { status: 502 })
  }
}
