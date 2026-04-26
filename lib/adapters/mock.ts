import slugify from 'slugify'
import { randomUUID } from 'crypto'
import type { CommunityRepository, CreateOptions } from '../repository'
import type { Community, CommunityInput } from '../types'

/**
 * In-memory repository used when no database is configured.
 * Pre-seeded with a few realistic communities so every flow is exercisable
 * without any external services.
 *
 * State is module-scoped (survives across requests in dev, resets on cold
 * start). This is intentional — it makes the mock feel live without
 * needing persistence.
 */

const SEED: Community[] = [
  {
    id: 'mock-1',
    name: 'Wicker Park Neighborhood Association',
    slug: 'wicker-park-neighborhood-association',
    description: 'Serving the Wicker Park community since 1973. We advocate for local businesses, green spaces, and safe streets.',
    category: 'neighborhood_association',
    website: 'https://example.com/wickerpark',
    email: 'hello@wickerpark.example',
    claimedBy: null,
    claimedAt: null,
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-87.677, 41.908],
          [-87.663, 41.908],
          [-87.663, 41.899],
          [-87.677, 41.899],
          [-87.677, 41.908],
        ]],
      },
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    emailPublic: true,
    updatedAt: null,
  },
  {
    id: 'mock-2',
    name: 'Logan Square Block Club',
    slug: 'logan-square-block-club',
    description: 'Monthly meetings, community clean-ups, and block parties.',
    category: 'block_club',
    website: null,
    email: 'logansquareblock@example.com',
    claimedBy: null,
    claimedAt: null,
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-87.710, 41.924],
          [-87.695, 41.924],
          [-87.695, 41.916],
          [-87.710, 41.916],
          [-87.710, 41.924],
        ]],
      },
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    emailPublic: true,
    updatedAt: null,
  },
  {
    id: 'mock-3',
    name: 'Bucktown HOA',
    slug: 'bucktown-hoa',
    description: null,
    category: 'hoa',
    website: 'https://bucktownhoa.example',
    email: null,
    claimedBy: null,
    claimedAt: null,
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-87.672, 41.921],
          [-87.660, 41.921],
          [-87.660, 41.912],
          [-87.672, 41.912],
          [-87.672, 41.921],
        ]],
      },
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    emailPublic: true,
    updatedAt: null,
  },
]

// Module-level store — survives across requests within a single server process.
const store = new Map<string, Community>(SEED.map((c) => [c.id, c]))

function deriveUniqueSlug(name: string): string {
  const base = slugify(name, { lower: true, strict: true })
  const existing = new Set([...store.values()].map((c) => c.slug))
  if (!existing.has(base)) return base

  let i = 2
  while (existing.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

export class MockCommunityRepository implements CommunityRepository {
  async create(input: CommunityInput, options?: CreateOptions): Promise<Community> {
    if (!input.website && !input.email) {
      throw new Error('At least one of website or email is required')
    }

    const nameExists = [...store.values()].some(
      (c) => c.name.toLowerCase() === input.name.toLowerCase()
    )
    if (nameExists) throw new Error('duplicate key value violates unique constraint')

    const community: Community = {
      id: randomUUID(),
      slug: deriveUniqueSlug(input.name),
      createdAt: new Date().toISOString(),
      updatedAt: null,
      claimedBy: options?.claimedBy ?? null,
      claimedAt: options?.claimedBy ? new Date().toISOString() : null,
      ...input,
    }
    store.set(community.id, community)
    return community
  }

  async getById(id: string): Promise<Community | null> {
    return store.get(id) ?? null
  }

  async getBySlug(slug: string): Promise<Community | null> {
    return [...store.values()].find((c) => c.slug === slug) ?? null
  }

  async list(): Promise<Community[]> {
    return [...store.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  async update(id: string, input: Partial<CommunityInput>): Promise<Community> {
    const existing = store.get(id)
    if (!existing) throw new Error('Community not found')

    const updated = { ...existing, ...input, updatedAt: new Date().toISOString() }
    if (!updated.website && !updated.email) {
      throw new Error('At least one of website or email is required')
    }

    store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    if (!store.has(id)) throw new Error('Community not found')
    store.delete(id)
  }

}
