import type { Community, CommunityInput } from './types'
import type { CreateOptions } from './repository'
import { db } from './db'

/**
 * Public API — these signatures are stable across all tiers.
 * Implementations live in lib/adapters/; swap the adapter in lib/db.ts.
 */

export function createCommunity(input: CommunityInput, options?: CreateOptions): Promise<Community> {
  return db.create(input, options)
}

export function getCommunity(id: string): Promise<Community | null> {
  return db.getById(id)
}

export function getCommunityBySlug(slug: string): Promise<Community | null> {
  return db.getBySlug(slug)
}

export function listCommunities(): Promise<Community[]> {
  return db.list()
}

export function updateCommunity(id: string, input: Partial<CommunityInput>): Promise<Community> {
  // Not exposed via a public route in Tier 1 — no auth yet.
  return db.update(id, input)
}

export function deleteCommunity(id: string): Promise<void> {
  return db.delete(id)
}
