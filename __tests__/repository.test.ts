import { describe, it, expect, beforeEach } from 'vitest'
import { MockCommunityRepository } from '@/lib/adapters/mock'
import type { CommunityInput } from '@/lib/types'

// Use a counter to generate unique names per test (mock store is module-scoped)
let counter = 0
function uniqueInput(overrides?: Partial<CommunityInput>): CommunityInput {
  counter++
  return {
    name: `Test Neighborhood ${counter}-${Date.now()}`,
    description: 'A test community for unit tests',
    category: 'neighborhood_association',
    website: 'https://example.com',
    email: null,
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-93.25, 44.92],
          [-93.24, 44.92],
          [-93.24, 44.91],
          [-93.25, 44.91],
          [-93.25, 44.92],
        ]],
      },
    },
    ...overrides,
  }
}

describe('MockCommunityRepository', () => {
  let repo: MockCommunityRepository

  beforeEach(() => {
    repo = new MockCommunityRepository()
  })

  it('creates a community and assigns id, slug, createdAt', async () => {
    const input = uniqueInput()
    const community = await repo.create(input)
    expect(community.id).toBeDefined()
    expect(community.slug).toBeDefined()
    expect(community.createdAt).toBeDefined()
    expect(community.name).toBe(input.name)
  })

  it('retrieves a community by id', async () => {
    const created = await repo.create(uniqueInput())
    const fetched = await repo.getById(created.id)
    expect(fetched).toEqual(created)
  })

  it('retrieves a community by slug', async () => {
    const created = await repo.create(uniqueInput())
    const fetched = await repo.getBySlug(created.slug)
    expect(fetched?.id).toBe(created.id)
  })

  it('returns null for non-existent id', async () => {
    const fetched = await repo.getById('non-existent-id')
    expect(fetched).toBeNull()
  })

  it('lists communities sorted by createdAt descending', async () => {
    const list = await repo.list()
    for (let i = 1; i < list.length; i++) {
      expect(new Date(list[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(list[i].createdAt).getTime()
      )
    }
  })

  it('updates a community', async () => {
    const created = await repo.create(uniqueInput())
    const updated = await repo.update(created.id, { description: 'Updated description' })
    expect(updated.description).toBe('Updated description')
    expect(updated.name).toBe(created.name)
  })

  it('rejects update that removes all contact methods', async () => {
    const created = await repo.create(uniqueInput())
    await expect(
      repo.update(created.id, { website: null, email: null })
    ).rejects.toThrow('At least one of website or email')
  })

  it('deletes a community', async () => {
    const created = await repo.create(uniqueInput())
    await repo.delete(created.id)
    const fetched = await repo.getById(created.id)
    expect(fetched).toBeNull()
  })

  it('throws when deleting non-existent community', async () => {
    await expect(repo.delete('non-existent-id')).rejects.toThrow('not found')
  })

  it('rejects creation without contact method', async () => {
    await expect(
      repo.create(uniqueInput({ website: null, email: null }))
    ).rejects.toThrow('At least one of website or email')
  })
})
