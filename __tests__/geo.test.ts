import { describe, it, expect, vi, beforeAll } from 'vitest'

// Must set env before any imports that trigger db.ts evaluation
vi.stubEnv('COMMUNITY_ADAPTER', 'mock')

// Now import — db.ts singleton will see the mock adapter env
const { getCommunitiesAtPoint } = await import('@/lib/geo')

describe('getCommunitiesAtPoint', () => {
  it('returns communities whose polygon contains the point', async () => {
    // The mock adapter seeds include Wicker Park at roughly [-87.677, 41.908] to [-87.663, 41.899]
    const results = await getCommunitiesAtPoint(41.903, -87.670)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some((c) => c.slug === 'wicker-park-neighborhood-association')).toBe(true)
  })

  it('returns empty array for a point outside all polygons', async () => {
    const results = await getCommunitiesAtPoint(0, 0)
    expect(results).toEqual([])
  })
})
