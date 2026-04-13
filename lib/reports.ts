import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function createReport(
  communityId: string,
  reason: string,
  reporterEmail?: string
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Non-Supabase environments: silently accept (no table to write to)
    return
  }

  const client = getClient()
  const { error } = await client.from('reports').insert({
    community_id: communityId,
    reason,
    reporter_email: reporterEmail ?? null,
  })

  if (error) throw new Error(error.message)
}
