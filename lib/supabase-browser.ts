import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client singleton.
 * Used for auth operations in client components.
 * Import this instead of calling createClient() directly in components.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
