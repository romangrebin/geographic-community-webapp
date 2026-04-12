import type { CommunityInput } from './types'

/**
 * Server-side input validation for community creation and updates.
 * This runs on every API write — client-side validation is a UX nicety,
 * this is the security boundary.
 */

const MAX_NAME_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 5000
const MAX_CATEGORY_LENGTH = 100
const MAX_GEOJSON_BYTES = 500_000 // ~500 KB
const MAX_AREA_KM2 = 40

// Categories we recognize; freeform strings are allowed but capped.
const KNOWN_CATEGORIES = new Set([
  'neighborhood_association',
  'block_club',
  'hoa',
  'watershed',
  'parish',
  'school_zone',
  'other',
])

type ValidationResult =
  | { ok: true; sanitized: CommunityInput }
  | { ok: false; error: string }

/**
 * Normalize a website URL server-side (mirrors RegisterSheet logic).
 * Returns null for empty input, a valid https URL string, or throws.
 */
export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null
  const trimmed = raw.trim()

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    return null // caller should treat as validation error
  }

  // Block dangerous schemes that could sneak through
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  // Require a real-ish hostname
  if (!url.hostname.includes('.')) return null

  return url.toString()
}

/**
 * Validate a full CommunityInput for creation.
 */
export function validateCommunityInput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' }
  }

  const input = raw as Record<string, unknown>

  // Name
  if (typeof input.name !== 'string' || !input.name.trim()) {
    return { ok: false, error: 'Name is required' }
  }
  const name = input.name.trim()
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` }
  }

  // Description
  let description: string | null = null
  if (input.description != null) {
    if (typeof input.description !== 'string') {
      return { ok: false, error: 'Description must be a string' }
    }
    const trimmed = input.description.trim()
    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
      return { ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` }
    }
    description = trimmed || null
  }

  // Category
  let category = 'other'
  if (input.category != null) {
    if (typeof input.category !== 'string') {
      return { ok: false, error: 'Category must be a string' }
    }
    category = input.category.trim()
    if (category.length > MAX_CATEGORY_LENGTH) {
      return { ok: false, error: `Category must be ${MAX_CATEGORY_LENGTH} characters or fewer` }
    }
    if (!category) category = 'other'
  }

  // Contact — at least one required
  const websiteRaw = typeof input.website === 'string' ? input.website : null
  const emailRaw = typeof input.email === 'string' ? input.email.trim() : null

  let website: string | null = null
  if (websiteRaw && websiteRaw.trim()) {
    website = normalizeWebsiteUrl(websiteRaw)
    if (!website) {
      return { ok: false, error: 'Website must be a valid URL (e.g. https://example.com)' }
    }
  }

  let email: string | null = emailRaw || null
  if (email) {
    // Basic format check — not exhaustive, just catches obvious junk
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Email must be a valid email address' }
    }
    if (email.length > 320) {
      return { ok: false, error: 'Email is too long' }
    }
  }

  if (!website && !email) {
    return { ok: false, error: 'At least one of website or email is required' }
  }

  // GeoJSON
  if (!input.geojson || typeof input.geojson !== 'object') {
    return { ok: false, error: 'Boundary (geojson) is required' }
  }

  // Size gate — reject absurdly large payloads before parsing geometry
  const geojsonStr = JSON.stringify(input.geojson)
  if (geojsonStr.length > MAX_GEOJSON_BYTES) {
    return { ok: false, error: 'GeoJSON payload is too large' }
  }

  // Structure validation
  const geo = input.geojson as Record<string, unknown>
  if (geo.type !== 'Feature' || !geo.geometry || typeof geo.geometry !== 'object') {
    return { ok: false, error: 'GeoJSON must be a Feature with a geometry' }
  }

  const geometry = geo.geometry as Record<string, unknown>
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
    return { ok: false, error: 'GeoJSON geometry must be a Polygon or MultiPolygon' }
  }

  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return { ok: false, error: 'GeoJSON geometry must have coordinates' }
  }

  // Area check (deferred import to keep this module light for non-geo callers)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { area } = require('@turf/turf')
    const areaSqKm = area(input.geojson) / 1_000_000
    if (areaSqKm > MAX_AREA_KM2) {
      return { ok: false, error: `Polygon is too large (${areaSqKm.toFixed(0)} km²). Max is ${MAX_AREA_KM2} km².` }
    }
  } catch {
    return { ok: false, error: 'Invalid GeoJSON geometry' }
  }

  return {
    ok: true,
    sanitized: {
      name,
      description,
      category,
      website,
      email,
      geojson: input.geojson as CommunityInput['geojson'],
    },
  }
}

/**
 * Validate a partial CommunityInput for updates.
 * Only validates fields that are present — missing fields are left unchanged.
 */
export function validateCommunityUpdate(raw: unknown): { ok: true; sanitized: Partial<CommunityInput> } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' }
  }

  const input = raw as Record<string, unknown>
  const sanitized: Partial<CommunityInput> = {}

  if ('name' in input) {
    if (typeof input.name !== 'string' || !input.name.trim()) {
      return { ok: false, error: 'Name must be a non-empty string' }
    }
    const name = input.name.trim()
    if (name.length > MAX_NAME_LENGTH) {
      return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` }
    }
    sanitized.name = name
  }

  if ('description' in input) {
    if (input.description != null && typeof input.description !== 'string') {
      return { ok: false, error: 'Description must be a string or null' }
    }
    const trimmed = typeof input.description === 'string' ? input.description.trim() : null
    if (trimmed && trimmed.length > MAX_DESCRIPTION_LENGTH) {
      return { ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` }
    }
    sanitized.description = trimmed || null
  }

  if ('category' in input) {
    if (typeof input.category !== 'string') {
      return { ok: false, error: 'Category must be a string' }
    }
    const category = input.category.trim()
    if (category.length > MAX_CATEGORY_LENGTH) {
      return { ok: false, error: `Category must be ${MAX_CATEGORY_LENGTH} characters or fewer` }
    }
    sanitized.category = category || 'other'
  }

  if ('website' in input) {
    const websiteRaw = typeof input.website === 'string' ? input.website : null
    if (websiteRaw && websiteRaw.trim()) {
      const website = normalizeWebsiteUrl(websiteRaw)
      if (!website) {
        return { ok: false, error: 'Website must be a valid URL (e.g. https://example.com)' }
      }
      sanitized.website = website
    } else {
      sanitized.website = null
    }
  }

  if ('email' in input) {
    const emailRaw = typeof input.email === 'string' ? input.email.trim() : null
    if (emailRaw) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return { ok: false, error: 'Email must be a valid email address' }
      }
      if (emailRaw.length > 320) {
        return { ok: false, error: 'Email is too long' }
      }
      sanitized.email = emailRaw
    } else {
      sanitized.email = null
    }
  }

  if ('geojson' in input) {
    if (!input.geojson || typeof input.geojson !== 'object') {
      return { ok: false, error: 'GeoJSON must be an object' }
    }
    const geojsonStr = JSON.stringify(input.geojson)
    if (geojsonStr.length > MAX_GEOJSON_BYTES) {
      return { ok: false, error: 'GeoJSON payload is too large' }
    }
    const geo = input.geojson as Record<string, unknown>
    if (geo.type !== 'Feature' || !geo.geometry || typeof geo.geometry !== 'object') {
      return { ok: false, error: 'GeoJSON must be a Feature with a geometry' }
    }
    const geometry = geo.geometry as Record<string, unknown>
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      return { ok: false, error: 'GeoJSON geometry must be a Polygon or MultiPolygon' }
    }
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      return { ok: false, error: 'GeoJSON geometry must have coordinates' }
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { area } = require('@turf/turf')
      const areaSqKm = area(input.geojson) / 1_000_000
      if (areaSqKm > MAX_AREA_KM2) {
        return { ok: false, error: `Polygon is too large (${areaSqKm.toFixed(0)} km²). Max is ${MAX_AREA_KM2} km².` }
      }
    } catch {
      return { ok: false, error: 'Invalid GeoJSON geometry' }
    }
    sanitized.geojson = input.geojson as CommunityInput['geojson']
  }

  if (Object.keys(sanitized).length === 0) {
    return { ok: false, error: 'No valid fields to update' }
  }

  return { ok: true, sanitized }
}

/**
 * Check that the request Origin header matches the expected host.
 * Returns true if the request is safe (same-origin or server-side).
 */
export function checkOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')

  // No origin header = same-origin navigation or server-side call (safe)
  if (!origin) return true

  // In development, allow localhost
  const host = request.headers.get('host')
  if (!host) return true

  try {
    const originHost = new URL(origin).host
    return originHost === host
  } catch {
    return false
  }
}
