# Polygon size / geometry validation

## What enforces the 40 km² limit

- `lib/geometryValidation.ts` — single source of truth: `MAX_AREA_KM2` and
  `validatePolygonGeometry(feature)`, checking `booleanValid` + `kinks` (self-
  intersection) + area via `@turf/turf`. Used by both the client draw/edit flow
  and the server API validation, so the cap and the "invalid geometry" check
  can't drift between the two.
- Client: `app/useMapPageState.ts` — `handleDrawComplete` calls it for both the
  initial draw (`draw.create`) and vertex-drag edits (`draw.update`), covering
  both "create a new community" and "edit an existing community's boundary."
  On failure it dispatches `DRAW_ERROR` and does not commit the new shape to state.
- Server: `lib/validation.ts` — `validateCommunityInput` (POST) and
  `validateCommunityUpdate` (PATCH) both lazily `require('./geometryValidation')`
  to keep the module light for callers that don't touch geometry (e.g. the
  claim/reports routes only need `checkOrigin`).

## UX fix: disable Save/Register while the boundary is invalid

Previously, if a vertex drag pushed a polygon over the limit, `draw.update` fired,
validation rejected it, `DRAW_ERROR` showed — but the maplibre-gl-draw plugin's
internal feature already reflected the new (rejected) coordinates, so the map kept
showing the oversized shape even though the app's committed state (`state.panel.geojson`
/ `state.panel.community.geojson`) correctly held on to the last valid one. Two
confusing consequences:

- **Editing an existing community**: user drags past the limit, sees the warning,
  clicks "Save changes" anyway — the save (correctly) reverts to the last valid
  boundary, but nothing stopped the click or explained why the saved shape doesn't
  match what's on screen.
- **Creating a new community**: after the initial draw, the "Community details"
  sidebar stays open and vertices remain draggable; the same mismatch could happen
  there between what's drawn and what would actually be registered.

First pass tried reverting the on-screen polygon to the last valid shape on
rejection (`draw.add` back to the prior coordinates). Rejected in review — prefer a
less invasive fix and to be consulted on UX approaches before implementation (see
below). Went with instead: **disable the Save/Register button whenever `drawError`
is set**, so an invalid boundary simply can't be submitted, and surface *why*:

- `app/MapPage.tsx` — the top-of-map warning banner was gated on
  `drawMode === 'drawing'`, which used to go false once the initial polygon
  completed (`drawMode` became `'drawn'` for the create flow). Fixed to key off
  `isDrawActive` (`drawMode !== 'off'`) so the error shows any time drawing/editing
  is active, not just mid-initial-draw — otherwise a size error from editing after
  the sidebar opens would have nowhere to render. The remaining "click the map to
  place points" instruction text now keys off `panel.type === 'closed'` instead of
  `drawMode`, since that's the only state that actually means "no polygon exists yet."
- `components/RegisterSheet.tsx` / `components/CommunitySidebar.tsx`
  (`EditCommunityPanel`) — both now take a `drawError` prop, fold `!drawError` into
  their `canSubmit`/`canSave` checks, and show a short inline red hint next to the
  button (matching the existing "provide a website or email" pattern already used
  there) so the reason is visible right at the button, not just in the map banner.
- `components/Map.tsx` is untouched — no snap-back, no behavior change to the draw
  plugin itself.

## Other cleanup from the same pass

`handleUpdateCommunity` in `app/useMapPageState.ts` only includes `geojson` in the
PATCH payload if the boundary actually changed (compared via `turf/booleanEqual`
against `state.editGeojson`, the pre-edit original). Otherwise, editing an unrelated
field (name, description, ...) on a community whose *unchanged* boundary predates
the 40 km² limit (grandfathered) would get rejected by the server's area check even
though the user never touched the geometry.

### Removed the `DrawMode` `'drawn'` state

`DrawMode` was `'off' | 'drawing' | 'drawn'`. `'drawn'` was set exactly once
(`DRAW_COMPLETE`) and never read anywhere — it was a pure duplicate of
`panel.type === 'form'` (the two were always set together, and `SHOW_FORM`, the
only other action that could produce `panel.type === 'form'`, is itself dead code —
defined but never dispatched). That redundancy is exactly what caused the banner
bug above: two pieces of state meant to move in lockstep, checked inconsistently.
Simplified `DrawMode` to `'off' | 'drawing'`; `DRAW_COMPLETE` no longer touches
`drawMode` at all. Considered but didn't take: collapsing to a plain boolean
(`drawActive`), or renaming to reflect the actual maplibre-gl-draw mode
(`draw_polygon` vs `direct_select`) — both are real improvements but bigger
diffs than warranted here. `panel.type` is now the single source of truth for
"which phase of create/edit are we in."

### `booleanValid` doesn't catch self-intersecting polygons — added a `kinks` check

Discovered via manual UI testing: drawing a self-intersecting ("bowtie") polygon
didn't trigger the "invalid geometry" error. Root cause is in `@turf/boolean-valid`
itself (`node_modules/@turf/boolean-valid/dist/esm/index.js`) — for a `Polygon` it
only checks ring closure and a "spikes/punctures" case (a vertex sitting exactly on
another edge); it never checks whether two non-adjacent edges of the same ring
actually cross. Confirmed with a real exploit: a bowtie spanning a genuine
~94km × 111km bounding box (~8,800 km² as a normal rectangle) reports as **0 km²**
via `turf.area()` (the shoelace-formula terms from the two crossing lobes cancel
out) and passes `booleanValid`. This isn't cosmetic — `lib/geo.ts`
(`getCommunitiesAtPoint`, backing `/api/communities/at-point`) uses
`booleanPointInPolygon` directly against the stored geojson, and a point inside one
of the bowtie's lobes (~14km from the shape's "center") does match — so the shape is
fully live for location lookups despite reporting as ~0 km², making it a real bypass
of the 40 km² cap, not just a missing error message.

Fixed by adding a `kinks(feature).features.length > 0` check to
`validatePolygonGeometry` in `lib/geometryValidation.ts`, before the area check
(since area is exactly the thing that's unreliable on self-intersecting shapes).
`kinks` supports both `Polygon` and `MultiPolygon`. Verified: the bowtie above now
returns the "invalid geometry" error, a normal small polygon still passes, and a
normal (non-self-intersecting) oversized polygon still gets the "too large" message.

## Known environment issue (unrelated to this change)

`npm run test` (vitest) fails to even load its config in this checkout, under both
available local Node versions (`~/.nvm/versions/node/v18.20.4` and `v22.7.0`) —
different `ERR_REQUIRE_ESM`/`styleText` errors in each, before any test file runs.
Confirmed pre-existing (unrelated to these edits) since it fails at config-load time.
Verified this change instead via `tsc --noEmit` (clean, aside from one pre-existing
unrelated error in `__tests__/repository.test.ts`) and manual code review. Test suite
needs a working Node version pinned/fixed before `npm run test` will run again.
