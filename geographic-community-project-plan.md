geographic.community is a map-first public directory for geographically-defined communities: neighborhood associations, block clubs, and similar organizations whose membership is determined by where you live. On the organizer side, anyone can register a community by drawing a polygon on a map and providing a name plus at least one contact method (an email address or website URL). On the resident side, anyone can input a geographic point (by clicking a map or otherwise), and instantly see every registered community whose boundaries contain that point along with the contact info needed to get involved. Eventually we'll add more controls, auth, privacy, and optimization, but we want to start simple.

The product is a discovery tool, not a social network; there are no feeds, posts, or messaging, and no account is required to browse. The north star is that a person who just moved to a new neighborhood should be able to open the app, tap their address, and find out within seconds what organized communities exist in their area and how to join them. When in doubt, prioritize the two core flows over everything else:
 1. registering a community
and
 2. discovering communities at a point


# geographic.community - Project Plan

## Guiding Principles

- **Interfaces are stable; implementations are not.** Function signatures are defined once and respected across tiers. The internals swap out as scale demands.
- **Tier 1 is the real product.** It should feel complete and polished, not like a prototype.
- **Defer everything that requires a user account.** No auth in Tier 1. Communities require only a name, a polygon, and either an email address or a website URL.
- **Work iteratively.** Stop regularly to ensure functionality works and focus on breaking work out into chunks that can be manually verified.

---

## Core Function Interface (canonical, all tiers)

These live in `lib/geo.ts` and `lib/communities.ts`. Their signatures never change.

```ts
// lib/geo.ts
getCommunitiesAtPoint(lat: number, lng: number): Promise<Community[]>
getCommunitiesInViewport(bbox: BBox): Promise<Community[]>

// lib/communities.ts
createCommunity(input: CommunityInput): Promise<Community>
getCommunity(id: string): Promise<Community | null>
getCommunityBySlug(slug: string): Promise<Community | null>
listCommunities(): Promise<Community[]>
updateCommunity(id: string, input: Partial<CommunityInput>): Promise<Community>
```

**Tier 1 implementation note:** `getCommunitiesAtPoint` and `getCommunitiesInViewport` both just call `listCommunities()` and filter with Turf.js. This is fine. When the time comes, only the function body changes.

---

## Data Model

```ts
type Community = {
  id: string                // uuid
  name: string
  slug: string              // url-safe, e.g. "elmwood-neighborhood-assoc"
  description: string | null
  category: CommunityCategory
  website: string | null    // at least one of website or email is required
  email: string | null
  geojson: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
  createdAt: string
}

type CommunityCategory =
  | 'neighborhood_association'
  | 'block_club'
  | 'hoa'
  | 'watershed'
  | 'parish'
  | 'school_zone'
  | 'other'

type CommunityInput = Omit<Community, 'id' | 'slug' | 'createdAt'> & {
  // slug is derived from name server-side
}
```

```sql
-- Supabase / Postgres - Tier 1 schema
CREATE TABLE communities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'other',
  website     text,
  email       text,
  geojson     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Constraint: at least one contact method required
  CONSTRAINT has_contact CHECK (website IS NOT NULL OR email IS NOT NULL)
);
```

> **Migration path to Tier 2:** `ALTER TABLE communities ADD COLUMN geom geometry(MultiPolygon, 4326); UPDATE communities SET geom = ST_GeomFromGeoJSON(geojson->>'geometry'); CREATE INDEX ON communities USING GIST(geom);`  The `geojson` column stays as the source of truth for the API response layer.

---

## Tier 1 - MVP

### Epic 1 · Project Setup

- [ ] **T1-01** Initialize Next.js app (App Router, TypeScript, Tailwind)
- [ ] **T1-02** Set up Supabase project; run schema migration; configure env vars
- [ ] **T1-03** Install and configure MapLibre GL JS with a Protomaps or Stadia tile source
- [ ] **T1-04** Install `maplibre-gl-draw` (the maintained community fork; prefer this over `@mapbox/mapbox-gl-draw` which targets Mapbox GL and has known friction with MapLibre), `@turf/turf`
- [ ] **T1-05** Define shared TypeScript types (`Community`, `CommunityInput`, `BBox`, etc.) in `lib/types.ts`
- [ ] **T1-06** Stub out all function signatures in `lib/geo.ts` and `lib/communities.ts` with `throw new Error("not implemented")` - establishes the contract before any implementation

---

### Epic 2 · Data Layer

- [ ] **T1-07** Implement `createCommunity` - insert row, derive slug from name (slugify + uniqueness check), return created community
- [ ] **T1-08** Implement `getCommunity(id)` and `getCommunityBySlug(slug)`
- [ ] **T1-09** Implement `listCommunities()` - simple `SELECT *` for now
- [ ] **T1-10** Implement `getCommunitiesAtPoint(lat, lng)` - calls `listCommunities()`, filters with `turf.booleanPointInPolygon()`
- [ ] **T1-11** Stub `getCommunitiesInViewport(bbox)` - leave as `throw new Error("not implemented")`; the Tier 1 map loads all polygons on init so this function is not called anywhere yet; implement in Tier 2 alongside the PostGIS swap
- [ ] **T1-12** Implement `updateCommunity` - simple update by id, re-validate contact constraint; **do not expose via a public API route or Server Action in Tier 1** - the function exists for future use but there is no auth yet to gate it
- [ ] **T1-13** Wire functions into Next.js Server Actions (or `/api` route handlers) - one action per function; omit `updateCommunity` (see T1-12)

---

### Epic 3 · Map Foundation

- [ ] **T1-14** Build `<Map />` component - full-bleed MapLibre canvas, initializes to a sensible default center/zoom
- [ ] **T1-15** Add `<CommunityPolygonLayer />` - fetches `listCommunities()` on load, renders all polygons as a fill + outline layer
- [ ] **T1-16** Polygon hover state - highlight on hover, show community name tooltip
- [ ] **T1-17** Map click handler - fires `getCommunitiesAtPoint(lat, lng)`, passes results to sidebar
- [ ] **T1-18** `<CommunitySidebar />` - shows list of communities returned by a point query; empty state when no communities at point

---

### Epic 4 · Community Detail

- [ ] **T1-19** Route: `/c/[slug]` - public community page
- [ ] **T1-20** Show community name, description, category badge
- [ ] **T1-21** Show small embedded map with the community polygon highlighted


---

### Epic 5 · Register a Community (Organizer Flow)

- [ ] **T1-24** Route: `/register` - two-step flow: (1) draw polygon, (2) fill metadata
- [ ] **T1-25** Step 1 - embed `<Map />` with MapLibre GL Draw enabled; user draws a polygon; store GeoJSON in form state
- [ ] **T1-26** Client-side polygon validation before allowing step 2: `turf.booleanValid()` for geometry validity; `turf.area()` to enforce a reasonable size cap (e.g. reject polygons larger than a major city, ~1 000 km²); show friendly errors for each case
- [ ] **T1-27** Step 2 - form: name (required), description (optional), category (select), website (optional*), email (optional*); note that at least one of website/email is required
- [ ] **T1-28** Contact method validation - form-level check: at least one of email or website must be filled before submit is enabled
- [ ] **T1-29** Submit → `createCommunity` server action → redirect to `/c/[slug]`
- [ ] **T1-30** Basic error handling - duplicate name, invalid polygon (server-side catch), DB errors

---

### Epic 6 · Discovery Flow (Resident/Visitor)

- [ ] **T1-31** Landing page is the map - no separate "explore" page; the map IS the homepage
- [ ] **T1-32** Address/place search bar (use MapLibre + a free geocoder like Nominatim or Photon) to navigate the map
- [ ] **T1-33** "You are here" UX - if user grants geolocation, auto-run `getCommunitiesAtPoint` on their location and open the sidebar
- [ ] **T1-34** Empty state - when the map has no polygons in view, show a subtle "Register a community" CTA

---

### Epic 7 · Polish & Launch Readiness

- [ ] **T1-35** Mobile-responsive layout (map full-screen on mobile, sidebar as bottom sheet)
- [ ] **T1-36** `<head>` metadata and OG tags for community pages (for shareability)
- [ ] **T1-37** Basic error boundaries and loading states throughout
- [ ] **T1-38** Environment configuration: dev vs. prod Supabase URLs, tile provider keys
- [ ] **T1-39** Deploy to Vercel; confirm Supabase connection in production

---

## Tier 2 - Getting Real *(loose guidance)*

Trigger: you have 100+ communities or queries start feeling slow.

- Enable PostGIS extension; migrate `geojson` column → `geom geometry` column with GiST index
- Swap `getCommunitiesAtPoint` body to use `ST_Contains(geom, ST_Point($lng, $lat, 4326))`
- Swap `getCommunitiesInViewport` body to use `ST_Intersects(geom, ST_MakeEnvelope(...))`
- Server-side polygon validation: `ST_IsValid()` on submission; `ST_MakeValid()` as a repair fallback
- Email-based community claim flow: link sent to email, flip `claimed_by_email` and `claimed_at`
- Rate limit community creation (e.g. 5 communities per IP per day) via Upstash / middleware
- Add `updated_at` column + last-edited display on community pages
- Community edit flow (anyone with the right email can edit, honor-system still)

---

## Tier 3 - Scale *(very loose)*

Trigger: 1,000+ communities, map rendering gets slow, or you're seeing abuse.

- Serve polygon geometries as vector tiles (pg_tileserv or Protomaps workflow) so the browser only loads what's in the viewport
- Caching layer for hot point lookups (Upstash Redis)
- Proper verification workflow (postcard, domain verification, or manual review)
- Dispute resolution process for contested boundaries or impersonation
- Version history for polygon edits
- Community analytics (view counts, etc.)
- Consider a public API / open data export (ODbL license)
