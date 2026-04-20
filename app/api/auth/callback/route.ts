import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Auth callback handler.
 * Handles two flows:
 *   1. OAuth / PKCE — Supabase sends ?code=...  → exchangeCodeForSession()
 *   2. Magic link OTP — Supabase sends ?token_hash=...&type=magiclink → verifyOtp()
 * After a successful exchange the session cookie is set and the user is redirected home.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  const response = NextResponse.redirect(`${origin}${next}`)
  const supabase = createSupabaseServerClient(request, response)

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return response
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) return response
    console.error('[auth/callback] verifyOtp failed:', error.message)
  } else {
    console.error('[auth/callback] no code or token_hash in URL params:', Object.fromEntries(searchParams))
  }

  // If anything went wrong, redirect home anyway
  return NextResponse.redirect(`${origin}/`)
}
