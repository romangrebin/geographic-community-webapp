import { describe, it, expect } from 'vitest'
import { validateCommunityInput, validateCommunityUpdate, normalizeWebsiteUrl, checkOrigin } from '@/lib/validation'

// ── Helper: valid GeoJSON polygon feature ──────────────────
const validPolygon = {
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
}

const validInput = {
  name: 'Test Community',
  description: 'A test community',
  category: 'neighborhood_association',
  website: 'https://example.com',
  email: null,
  geojson: validPolygon,
}

// ── normalizeWebsiteUrl ────────────────────────────────────

describe('normalizeWebsiteUrl', () => {
  it('returns null for empty or whitespace input', () => {
    expect(normalizeWebsiteUrl(null)).toBeNull()
    expect(normalizeWebsiteUrl('')).toBeNull()
    expect(normalizeWebsiteUrl('  ')).toBeNull()
  })

  it('prepends https:// when missing', () => {
    expect(normalizeWebsiteUrl('example.com')).toBe('https://example.com/')
  })

  it('preserves existing https://', () => {
    expect(normalizeWebsiteUrl('https://example.com')).toBe('https://example.com/')
  })

  it('preserves existing http://', () => {
    expect(normalizeWebsiteUrl('http://example.com')).toBe('http://example.com/')
  })

  it('rejects hostnames without a dot', () => {
    expect(normalizeWebsiteUrl('localhost')).toBeNull()
  })

  it('rejects javascript: URIs', () => {
    expect(normalizeWebsiteUrl('javascript:alert(1)')).toBeNull()
  })

  it('rejects data: URIs', () => {
    expect(normalizeWebsiteUrl('data:text/html,<h1>hi</h1>')).toBeNull()
  })
})

// ── validateCommunityInput ─────────────────────────────────

describe('validateCommunityInput', () => {
  it('accepts valid input', () => {
    const result = validateCommunityInput(validInput)
    expect(result.ok).toBe(true)
  })

  it('rejects non-object input', () => {
    expect(validateCommunityInput(null)).toEqual({ ok: false, error: 'Request body must be a JSON object' })
    expect(validateCommunityInput('string')).toEqual({ ok: false, error: 'Request body must be a JSON object' })
  })

  it('rejects missing name', () => {
    const result = validateCommunityInput({ ...validInput, name: '' })
    expect(result.ok).toBe(false)
  })

  it('rejects overly long name', () => {
    const result = validateCommunityInput({ ...validInput, name: 'a'.repeat(201) })
    expect(result.ok).toBe(false)
  })

  it('rejects overly long description', () => {
    const result = validateCommunityInput({ ...validInput, description: 'a'.repeat(5001) })
    expect(result.ok).toBe(false)
  })

  it('rejects when neither website nor email provided', () => {
    const result = validateCommunityInput({ ...validInput, website: null, email: null })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('At least one')
  })

  it('rejects invalid email format', () => {
    const result = validateCommunityInput({ ...validInput, website: null, email: 'not-an-email' })
    expect(result.ok).toBe(false)
  })

  it('rejects missing geojson', () => {
    const result = validateCommunityInput({ ...validInput, geojson: null })
    expect(result.ok).toBe(false)
  })

  it('rejects non-Polygon geometry', () => {
    const result = validateCommunityInput({
      ...validInput,
      geojson: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
    })
    expect(result.ok).toBe(false)
  })

  it('normalizes website URL in sanitized output', () => {
    const result = validateCommunityInput({ ...validInput, website: 'example.com' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.sanitized.website).toBe('https://example.com/')
  })

  it('trims name and description', () => {
    const result = validateCommunityInput({ ...validInput, name: '  Trimmed  ', description: '  desc  ' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.sanitized.name).toBe('Trimmed')
      expect(result.sanitized.description).toBe('desc')
    }
  })
})

// ── validateCommunityUpdate ────────────────────────────────

describe('validateCommunityUpdate', () => {
  it('accepts partial update with only name', () => {
    const result = validateCommunityUpdate({ name: 'New Name' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.sanitized.name).toBe('New Name')
  })

  it('rejects empty update', () => {
    const result = validateCommunityUpdate({})
    expect(result.ok).toBe(false)
  })

  it('rejects invalid website in update', () => {
    const result = validateCommunityUpdate({ website: 'javascript:alert(1)' })
    expect(result.ok).toBe(false)
  })
})

// ── checkOrigin ────────────────────────────────────────────

describe('checkOrigin', () => {
  it('allows requests without an Origin header', () => {
    const req = new Request('http://localhost/api/test', { method: 'POST' })
    expect(checkOrigin(req)).toBe(true)
  })

  it('allows same-origin requests', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
    })
    expect(checkOrigin(req)).toBe(true)
  })

  it('rejects cross-origin requests', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { origin: 'http://evil.com', host: 'localhost:3000' },
    })
    expect(checkOrigin(req)).toBe(false)
  })
})
