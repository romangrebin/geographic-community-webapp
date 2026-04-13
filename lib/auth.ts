import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'

/**
 * Stable auth interface — wraps Supabase Auth magic links today;
 * swap the implementation here without touching any caller.
 */

export type AuthUser = {
  id: string
  email: string
}

/**
 * Sends a magic link to the given email.
 * Call from client components via the browser client; this server version
 * is used when you need to trigger sign-in from a server context.
 */
export async function getUser(request: NextRequest): Promise<AuthUser | null> {
  const response = NextResponse.next()
  const supabase = createSupabaseServerClient(request, response)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return { id: user.id, email: user.email! }
}
