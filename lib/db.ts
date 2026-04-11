import type { CommunityRepository } from './repository'

/**
 * Returns the active repository adapter.
 *
 * Selection order:
 *   1. COMMUNITY_ADAPTER env var — explicit override, useful in tests:
 *        "mock"      → in-memory, pre-seeded, resets on restart
 *        "json-file" → file-backed local persistence (default for local dev)
 *        "supabase"  → force Supabase even if auto-detection would miss it
 *   2. Supabase — used when NEXT_PUBLIC_SUPABASE_URL is set.
 *   3. json-file — fallback for local dev without any external services.
 *
 * Adapters are imported lazily so unused ones don't affect the bundle.
 */
function createRepository(): CommunityRepository {
  const override = process.env.COMMUNITY_ADAPTER

  if (override === 'mock') {
    const { MockCommunityRepository } = require('./adapters/mock')
    return new MockCommunityRepository()
  }

  if (override === 'supabase' || process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { SupabaseCommunityRepository } = require('./adapters/supabase')
    return new SupabaseCommunityRepository()
  }

  // Local dev default: file-backed persistence that survives restarts.
  const { JsonFileCommunityRepository } = require('./adapters/json-file')
  console.info('[db] No NEXT_PUBLIC_SUPABASE_URL found — using local file adapter (.data/communities.json)')
  return new JsonFileCommunityRepository()
}

// Singleton — one adapter instance per server process.
export const db: CommunityRepository = createRepository()
