import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import slugify from 'slugify'
import type { CommunityRepository } from '../repository'
import type { Community, CommunityInput } from '../types'

/**
 * File-backed repository for local development.
 * Reads and writes a JSON file at DATA_FILE_PATH (default: .data/communities.json).
 * All functionality works across server restarts with no external services.
 */

const DATA_FILE_PATH = resolve(
  process.env.LOCAL_DATA_PATH ?? '.data/communities.json'
)

function read(): Map<string, Community> {
  if (!existsSync(DATA_FILE_PATH)) return new Map()
  const raw = readFileSync(DATA_FILE_PATH, 'utf-8')
  const arr: Community[] = JSON.parse(raw)
  return new Map(arr.map((c) => [c.id, c]))
}

function write(store: Map<string, Community>): void {
  mkdirSync(resolve(DATA_FILE_PATH, '..'), { recursive: true })
  const arr = [...store.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  writeFileSync(DATA_FILE_PATH, JSON.stringify(arr, null, 2), 'utf-8')
}

function deriveUniqueSlug(name: string, store: Map<string, Community>): string {
  const base = slugify(name, { lower: true, strict: true })
  const existing = new Set([...store.values()].map((c) => c.slug))
  if (!existing.has(base)) return base

  let i = 2
  while (existing.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

export class JsonFileCommunityRepository implements CommunityRepository {
  async create(input: CommunityInput): Promise<Community> {
    if (!input.website && !input.email) {
      throw new Error('At least one of website or email is required')
    }

    const store = read()

    const nameExists = [...store.values()].some(
      (c) => c.name.toLowerCase() === input.name.toLowerCase()
    )
    if (nameExists) throw new Error('duplicate key value violates unique constraint')

    const community: Community = {
      id: randomUUID(),
      slug: deriveUniqueSlug(input.name, store),
      createdAt: new Date().toISOString(),
      ...input,
    }

    store.set(community.id, community)
    write(store)
    return community
  }

  async getById(id: string): Promise<Community | null> {
    return read().get(id) ?? null
  }

  async getBySlug(slug: string): Promise<Community | null> {
    return [...read().values()].find((c) => c.slug === slug) ?? null
  }

  async list(): Promise<Community[]> {
    return [...read().values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  async update(id: string, input: Partial<CommunityInput>): Promise<Community> {
    const store = read()
    const existing = store.get(id)
    if (!existing) throw new Error('Community not found')

    const updated = { ...existing, ...input }
    if (!updated.website && !updated.email) {
      throw new Error('At least one of website or email is required')
    }

    store.set(id, updated)
    write(store)
    return updated
  }
}
