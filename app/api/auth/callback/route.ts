import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Magic link callback handler.
 * Supabase redirects here after the user clicks the magic link email.
 * We exchange the code for a session, set the auth cookie, then redirect home.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)
    const supabase = createSupabaseServerClient(request, response)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response
    }
  }

  // If anything went wrong, redirect home anyway
  return NextResponse.redirect(`${origin}/`)
}
