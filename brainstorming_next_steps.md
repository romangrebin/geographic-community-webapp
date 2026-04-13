# What's Next? — Brainstorming

Tier 1 is deployed and functional. The two core flows work (register a community, discover communities at a point). This document captures every direction the app could go from here, organized by theme.

---

## Design Guidance: Stable Interfaces, Swappable Implementations

The codebase already follows this principle in the data layer: `lib/repository.ts` defines the interface, `lib/db.ts` selects the adapter, and `lib/adapters/` contains the implementations (Supabase, JSON file, mock). Swapping the backend requires touching exactly one file.

**The same pattern should apply to every external dependency going forward — especially auth.**

The app should never call Supabase Auth APIs directly from components or API routes. Instead, all auth operations go through a thin `lib/auth.ts` module:

```ts
// lib/auth.ts — stable interface, swappable implementation
export async function signIn(email: string): Promise<void> { ... }
export async function signOut(): Promise<void> { ... }
export async function getSession(): Promise<Session | null> { ... }
export async function getUser(): Promise<User | null> { ... }
```

Today those functions wrap Supabase magic links. Tomorrow they could wrap passkeys, OAuth, or a completely different auth provider — without touching any component, API route, or hook that calls them.

**Why this matters:**
- Supabase Auth is a good starting point but it's not the end state. Passkeys are becoming the default expectation; OAuth is required for some enterprise use cases.
- Auth logic leaks into surprising places (middleware, API route guards, SSR data fetching). A central module makes it easy to audit and refactor.
- Testability: a mock auth adapter makes it trivial to write tests that run as an authenticated user without real tokens.

This principle extends beyond auth. Any time a new external service is introduced (geocoding, email, error tracking, analytics), the first question should be: *what's the minimal stable interface this needs to expose, and how do we hide the vendor behind it?*

---

## 1. Trust & Ownership

Right now, anyone can create, edit, or delete any community. There's no notion of "who owns this listing." This is the biggest gap between "working prototype" and "product people rely on."

### 1a. Tiered trust model: open-by-default with opt-in protection

The core tension: we want the app to be fully usable without an account, but we need to protect listings that real organizations care about. The solution is a **two-tier trust model**:

**Unclaimed communities** (created without signing in):
- Anyone can edit or delete them, just like today.
- No badge or indicator — they're just listings.
- This keeps the barrier to entry at zero — anyone can add their neighborhood association to the map in 30 seconds.

**Claimed communities** (created by or claimed by a signed-in user):
- Only the steward (the signed-in email) can edit or delete.
- They get a visible "Managed by contact@example.org" line on the listing. Stewardship is public — these are civic organizations with public contact info, not private accounts. Making the steward visible lets residents verify the listing is managed by the right people, and makes disputes transparent.
- A signed-in user can also "claim" an existing unclaimed community (useful when an organizer discovers someone already listed their org).

**The sign-in email *is* the community contact email.** If you're registering the Elmwood Neighborhood Association, you sign in with contact@elmwoodna.org. That email serves triple duty: it's your auth identity, the community's public contact method, and the visible steward. No separate "personal account" vs. "org email" distinction. If you want ownership protection, you provide an email and verify it. If you don't care, skip sign-in — the listing stays unclaimed and open.

**Why this works:**
- Zero friction for the 90% of visitors who just want to add a listing and move on.
- Real protection for the 10% who care — and the badge incentivizes claiming.
- Claiming an unclaimed community is a natural upgrade path, not a wall.
- No features are locked behind auth. Signed-in users get *protection*, not *capabilities*.
- Public stewardship is a trust signal the app doesn't have to verify — residents can cross-reference the steward email against the org's real website.

**Auth implementation:** Supabase Auth with magic link (email). No passwords, no OAuth complexity. The user signs in with their org's email, clicks a link, done. The email they sign in with is the email displayed on the listing.

**Data model changes:**
- Add `claimed_by` (uuid, nullable, FK to auth.users) and `claimed_at` (timestamptz, nullable) columns to `communities`.
- API routes check: if `claimed_by` is set and the request user isn't the owner, reject edits/deletes with 403.
- Unclaimed communities (`claimed_by IS NULL`) remain fully open.
- Future: support multiple stewards per community (boards have more than one person). Start with one — it covers 95% of cases.

### 1b. Rate limiting on creation

Cap community creation per IP (e.g., 5/day) via middleware or Upstash. Cheap insurance against spam before you have any auth.

**Why now:** A single bad actor can flood the map with garbage today.

### 1c. "Report this listing" button

Even without auth, let visitors flag a listing as spam, inaccurate, or impersonating. Store reports in a simple table. You review them manually for now.

**Why now:** You need a feedback channel from the public before you can trust the data quality.

---

## 2. Data Quality & Validation

### 2a. Server-side polygon repair

Use Turf's `cleanCoords` or (in Tier 2) PostGIS `ST_MakeValid()` to auto-fix minor geometry issues like self-intersections, bowties, or degenerate edges. Currently the server rejects invalid polygons but doesn't try to repair them.

**Why:** Real-world polygon drawing on a phone is imprecise. Auto-repair dramatically improves the success rate of registration.

### 2b. Polygon editing (not just redraw)

After drawing, let the user drag vertices to adjust the boundary. maplibre-gl-draw supports `simple_select` and `direct_select` modes — the wiring exists, it's just not exposed.

**Why:** "Redraw from scratch" is frustrating when you just need to nudge one corner. This is the single biggest UX pain point in the registration flow.

### 2c. Description / name length limits in UI

The server enforces limits (200 chars for name, 5000 for description) but the form doesn't show character counts or warn as you approach the limit.

**Why:** Prevents confusion when a submission silently fails because the server rejects it.

### 2d. Duplicate/overlap detection

When registering, warn if the new polygon overlaps significantly with an existing community. Not blocking — just informational ("This area overlaps with 'Elmwood Neighborhood Association'").

**Why:** Reduces accidental duplicates and gives organizers context about what's already registered.

---

## 3. Discovery & Usability

### 3a. Better empty state when the map has no polygons in view

The project plan (T1-34) calls for a "Register a community" CTA when the map is empty. It's partially there (the sidebar says "Know of one? Add it using the button above") but there's no map-level prompt.

**Why:** First-time visitors in areas with no communities see a blank map and may not understand what the app is for.

### 3b. Category filtering

Let users filter the map or the "All Communities" list by category (neighborhood association, block club, HOA, etc.). The data model supports it; the UI doesn't expose it.

**Why:** As the number of communities grows, filtering becomes essential for discovery.

### 3c. Community count badge on the map

Show a small floating badge like "12 communities in view" that updates as you pan/zoom. Gives users a sense of data density without clicking.

**Why:** Provides immediate feedback that the map is alive and has content.

### 3d. Improve address search

- Add a `User-Agent` header to Nominatim requests (required by their usage policy).
- Show attribution ("Powered by OpenStreetMap").
- Consider adding keyboard navigation (arrow keys) to the results dropdown.
- Possibly switch to a more permissive geocoding service if volume grows.

**Why:** Nominatim's terms of service require identification. And the search dropdown is mouse-only today, which is a usability and accessibility gap.

---

## 4. Look & Feel

### 4a. Custom 404 page

There's no `not-found.tsx`. A branded 404 with a link back to the map would be better than the Next.js default.

**Why:** Keeps users in the app when they hit a bad link.

### 4b. Loading skeleton for the sidebar

When a point query is in flight, the sidebar shows "Searching…" text. A shimmer/skeleton screen would feel more polished.

**Why:** Small polish detail, but it signals that the app is working and reduces perceived latency.

### 4c. Polish the mobile bottom sheet

The bottom sheet is a fixed 50% height div. It could be improved with:

- Drag-to-resize (grab handle at the top)
- Snap points (half screen, full screen, collapsed)
- Swipe-down to dismiss

**Why:** The current bottom sheet feels static. Native map apps (Google Maps, Apple Maps) set the expectation for fluid bottom sheets.

### 4d. Animate panel transitions

The desktop right panel slides in/out, but the mobile bottom sheet just appears/disappears. Adding a slide-up animation and smooth transitions between panel states (explore → detail → edit) would make the app feel more cohesive.

**Why:** Animations communicate state changes. Without them, panel swaps feel jarring on mobile.

---

## 5. Robustness & Developer Experience

### 5a. More test coverage

The test suite covers validation, the mock repository, and point-in-polygon logic. Missing:

- API route tests (HTTP-level: send a request, check the response)
- Component rendering tests (at least smoke tests for the main views)
- Edge cases: concurrent writes to the JSON file adapter, slug collision with many duplicates

**Why:** The app is changing fast. Tests are the cheapest way to avoid regressions.

### 5b. CI pipeline

Set up GitHub Actions to run `npm run test` and `npm run build` on every push/PR. Minimal config, huge payoff.

**Why:** Prevents deploying broken builds. Also makes it safe for others to contribute.

### 5c. Linting and formatting enforcement

ESLint is installed but there's no pre-commit hook or CI check. Add `lint-staged` + `husky` or equivalent.

**Why:** Consistent code style across contributors (including AI).

### 5d. Supabase Row Level Security

If RLS isn't enabled on the `communities` table, anyone with the anon key (visible in the client bundle) can bypass the API routes and write directly to Supabase. Enabling RLS with a permissive INSERT policy + restricted UPDATE/DELETE is low-effort, high-impact. This becomes even more important once the tiered trust model (1a) is in place — RLS can enforce the "only the owner can edit claimed communities" rule at the database level.

**Why:** The CSRF origin check protects the API routes, but it doesn't protect the Supabase client itself.

### 5e. Error tracking (Sentry or similar)

The ErrorBoundary catches React errors and logs them to `console.error`. In production, those logs vanish. Sentry's free tier captures errors with stack traces, user context, and source maps.

**Why:** You can't fix bugs you don't know about. Once the app is public, you need observability.

---

## 6. Accessibility

### 6a. ARIA attributes on interactive elements

The forms, panels, and map overlays lack `aria-label`, `aria-live`, `aria-required`, etc. Screen readers can't meaningfully navigate the sidebar or understand state changes.

**Why:** Accessibility is both an ethical obligation and a legal requirement in many jurisdictions.

### 6b. Focus management on panel transitions

When a panel opens, focus should move to it. When it closes, focus should return to the trigger element. Currently focus stays wherever it was.

**Why:** Keyboard-only users (including many power users, not just screen reader users) lose their place after every panel transition.

### 6c. Skip-to-content link

A hidden "Skip to main content" link at the top of the page for keyboard users who don't want to tab through the entire header.

**Why:** Standard accessibility practice, trivial to implement.

---

## 7. Tier 2 Infrastructure (from the project plan)

These are the items already outlined in the project plan's Tier 2 section. They're triggered by scale (100+ communities or noticeable slowness):

- **PostGIS migration** — swap turf.js point-in-polygon for `ST_Contains`, add GiST index
- **Viewport-based loading** — implement `getCommunitiesInViewport` so the map doesn't load every polygon on init
- **`updated_at` column** — track when communities were last edited, show it on the detail page

**Why:** The current architecture (load all communities, filter client-side) works for dozens of communities but will degrade noticeably past 100-200.

---

## 8. Community & Growth

### 8a. "Claim your community" landing page

A standalone page explaining what the app is, who it's for, and how to register — aimed at community organizers rather than residents. Something to link to from emails, social media, and local government websites.

**Why:** The map homepage is optimized for the resident discovery flow. Organizers need a different entry point that explains the value proposition.

### 8b. Embeddable widget

A small `<iframe>` or web component that organizations can embed on their own website to show their community boundary on a map.

**Why:** Gives community organizers a reason to share and link to the app. Free distribution.

### 8c. Open data export

Offer a GeoJSON or CSV download of all communities. License under ODbL.

**Why:** Open data attracts developers, journalists, and researchers — all of whom amplify the project.

---

## How to Think About Priority

A useful lens: **what would make you comfortable sharing the link with a real neighborhood association president and asking them to register?**

The answer is probably some combination of:

1. Tiered trust model (1a) — so their listing is protected once they sign in
2. Polygon editing (2b) — so they don't have to redraw when they mess up one corner
3. Rate limiting (1b) — so spam doesn't dilute legitimacy
4. Report button (1c) — so there's a feedback loop for bad data

Everything else enhances the experience but isn't blocking that first real-world handshake.
