import type { Community, CommunityInput } from './types'

/**
 * The canonical data contract. All storage backends implement this interface.
 * The public functions in lib/communities.ts delegate to whichever adapter
 * is registered in lib/db.ts — swap the adapter, nothing else changes.
 */
export interface CommunityRepository {
  create(input: CommunityInput): Promise<Community>
  getById(id: string): Promise<Community | null>
  getBySlug(slug: string): Promise<Community | null>
  list(): Promise<Community[]>
  update(id: string, input: Partial<CommunityInput>): Promise<Community>
  delete(id: string): Promise<void>
}
