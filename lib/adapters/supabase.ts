import { createClient } from '@supabase/supabase-js'
import slugify from 'slugify'
import type { CommunityRepository } from '../repository'
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
    createdAt: row.created_at as string,
  }
}

export class SupabaseCommunityRepository implements CommunityRepository {
  private client

  constructor() {
    this.client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
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

  async create(input: CommunityInput): Promise<Community> {
    if (!input.website && !input.email) {
      throw new Error('At least one of website or email is required')
    }
    const slug = await this.deriveUniqueSlug(input.name)
    const { data, error } = await this.client
      .from('communities')
      .insert({ ...input, slug })
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

    const { data, error } = await this.client
      .from('communities')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return rowToCommunity(data)
  }
}
