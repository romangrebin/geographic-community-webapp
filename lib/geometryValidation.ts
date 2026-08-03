import { area, booleanValid, kinks } from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Polygon geometry validation shared by the map's draw/edit UI (app/useMapPageState.ts)
 * and the API's server-side validation (lib/validation.ts) — one place for the area cap
 * so the two can't drift apart.
 */

export const MAX_AREA_KM2 = 40

export type PolygonValidationResult = { ok: true } | { ok: false; error: string }

export function validatePolygonGeometry(feature: Feature<Polygon | MultiPolygon>): PolygonValidationResult {
  if (!booleanValid(feature)) {
    return { ok: false, error: 'The polygon geometry is invalid. Please redraw.' }
  }
  // booleanValid doesn't catch self-intersecting rings (e.g. a "bowtie") — turf's area()
  // is unreliable on those (signed-area terms from crossing lobes can cancel out, so a
  // shape spanning thousands of km² can compute as ~0 km² and slip past the cap below).
  // kinks() finds actual edge-crossing points, which is the check that's actually needed here.
  if (kinks(feature).features.length > 0) {
    return { ok: false, error: 'The polygon geometry is invalid. Please redraw.' }
  }
  const areaSqKm = area(feature) / 1_000_000
  if (areaSqKm > MAX_AREA_KM2) {
    return { ok: false, error: `Polygon is too large (${areaSqKm.toFixed(0)} km²). Max is ${MAX_AREA_KM2} km².` }
  }
  return { ok: true }
}
