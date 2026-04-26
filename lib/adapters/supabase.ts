import { createClient } from '@supabase/supabase-js'
import slugify from 'slugify'
import type { CommunityRepository, CreateOptions } from '../repository'
import type { Community, CommunityInput } from '../types'

function rowToCommunity(row: Record<string, unknown>): Community {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    category: row.category as Community['category'],
    website: (row.website as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    geojson: row.geojson as Community['geojson'],
    emailPublic: (row.email_public as boolean) ?? true,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? null,
    claimedBy: (row.claimed_by as string | null) ?? null,
    claimedAt: (row.claimed_at as string | null) ?? null,
  }
}

export class SupabaseCommunityRepository implements CommunityRepository {
  /** Anon client — used for reads, respects RLS public_read policy. */
  private client
  /**
   * Write client — uses service role key to bypass RLS for server-side mutations.
   * Ownership is enforced at the API route layer before reaching the adapter,
   * so skipping RLS here is safe. Falls back to anon key in local dev without RLS.
   */
  private writeClient

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? anonKey
    this.client = createClient(url, anonKey)
    this.writeClient = createClient(url, serviceKey)
  }

  private async deriveUniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true })
    const { data } = await this.client
      .from('communities')
      .select('slug')
      .ilike('slug', `${base}%`)

    const existing = new Set((data ?? []).map((r: { slug: string }) => r.slug))
    if (!existing.has(base)) return base

    let i = 2
    while (existing.has(`${base}-${i}`)) i++
    return `${base}-${i}`
  }

  async create(input: CommunityInput, options?: CreateOptions): Promise<Community> {
    if (!input.website && !input.email) {
      throw new Error('At least one of website or email is required')
    }
    const slug = await this.deriveUniqueSlug(input.name)
    const { emailPublic, ...rest } = input
    const row: Record<string, unknown> = { ...rest, slug, email_public: emailPublic }
    if (options?.claimedBy) {
      row.claimed_by = options.claimedBy
      row.claimed_at = new Date().toISOString()
    }
    const { data, error } = await this.writeClient
      .from('communities')
      .insert(row)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return rowToCommunity(data)
  }

  async getById(id: string): Promise<Community | null> {
    const { data, error } = await this.client
      .from('communities')
      .select()
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? rowToCommunity(data) : null
  }

  async getBySlug(slug: string): Promise<Community | null> {
    const { data, error } = await this.client
      .from('communities')
      .select()
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? rowToCommunity(data) : null
  }

  async list(): Promise<Community[]> {
    const { data, error } = await this.client
      .from('communities')
      .select()
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToCommunity)
  }

  async update(id: string, input: Partial<CommunityInput>): Promise<Community> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('Community not found')

    const merged = { ...existing, ...input }
    if (!merged.website && !merged.email) {
      throw new Error('At least one of website or email is required')
    }

    const { emailPublic, ...rest } = input
    const dbInput: Record<string, unknown> = { ...rest }
    if (emailPublic !== undefined) dbInput.email_public = emailPublic

    const { data, error } = await this.writeClient
      .from('communities')
      .update(dbInput)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return rowToCommunity(data)
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.writeClient
      .from('communities')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  }
}
