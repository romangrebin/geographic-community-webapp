# geographic.community

A map-first public directory for geographically-defined communities - neighborhood associations, block clubs, HOAs, watersheds, and similar organizations whose membership is determined by where you live.

The goal is discoverability: residents should be able to click anywhere on a map and immediately see what community organizations exist there. There are no feeds, no posts, no messaging. It is a directory, not a social network.

**Live site:** [geographic.community](https://geographic.community)

---

## Features

- **Map-first browsing** - click anywhere to see communities at that location
- **Draw to register** - trace a polygon on the map to define a community's boundary
- **Boundary editing** - drag vertices to adjust an existing boundary
- **Steward ownership** - sign in with a magic link to claim a community and become its verified steward
- **Trust badges** - claimed communities display a steward badge on the map and in listings
- **Report listings** - users can flag inaccurate or spam listings
- **ntfy notifications** - optional push notifications for new reports

## Tech stack

### External services

- **[Supabase](https://supabase.com/)** - Postgres database and magic-link auth (free tier)
- **[Vercel](https://vercel.com/)** - hosting and edge deployments (free tier)
- **[porkbun](https://porkbun.com/)** - domain management (around $30/year)
- **[Carto](https://carto.com/)** - basemap tile service (free tier, 5M tiles/month, API key required)
- **[ntfy](https://ntfy.sh/)** - optional push notifications for new reports (no account required)

### Key open source libraries

- **[Next.js](https://nextjs.org/)** - React framework (App Router, TypeScript)
- **[Tailwind CSS v4](https://tailwindcss.com/)** - utility-first styling
- **[MapLibre GL JS](https://maplibre.org/)** - WebGL map rendering
- **[maplibre-gl-draw](https://github.com/mapbox/mapbox-gl-draw)** - polygon drawing and editing
- **[Turf.js](https://turfjs.org/)** - geospatial calculations (area, point-in-polygon)
- **[@supabase/ssr](https://github.com/supabase/ssr)** - cookie-based auth helpers for Next.js

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side writes) |
| `NEXT_PUBLIC_CARTO_API_KEY` | CARTO basemap API key ([free tier](https://carto.com/basemaps/apikey/), 5M tiles/month). Without it the map tiles show an "API KEY REQUIRED" watermark. |
| `NTFY_URL` | Optional - ntfy push notification URL for new reports |

The app also works without Supabase by falling back to a local JSON file at `.data/communities.json`. This is useful for front-end development without a database.

### 3. Set up Supabase (if using)

Run the schema migration against your Supabase project:

```bash
# In the Supabase dashboard SQL editor, or via CLI:
psql -h <host> -U postgres -d postgres -f supabase/schema.sql
```

Enable **Email** provider in Supabase Auth → Providers. Magic links work without any additional configuration once the email provider is enabled.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

### Data layer

The app uses a repository pattern with swappable adapters:

- **`lib/repository.ts`** - interface definition
- **`lib/adapters/supabase.ts`** - production adapter (Postgres via Supabase)
- **`lib/adapters/json-file.ts`** - local dev adapter (reads/writes `.data/communities.json`)
- **`lib/adapters/mock.ts`** - in-memory adapter for tests

The adapter is selected in `lib/db.ts` based on whether `NEXT_PUBLIC_SUPABASE_URL` is set.

### State machine

All map page state lives in `app/useMapPageState.ts` as a `useReducer`-based state machine. Panel navigation, draw mode, edit mode, and point queries are all modelled as explicit state transitions - no ad-hoc boolean flags.

### Auth

Server-side auth uses `@supabase/ssr` with cookie-based sessions. The `getUser()` helper in `lib/auth.ts` is used by API routes to check the current user without exposing the service role key to the client.

Write operations use the service role key server-side (bypassing RLS) with ownership enforced at the API route layer. Direct client access to the database is restricted to reads via RLS policies.

## Deployment

The app is designed for Vercel. Add the same environment variables from `.env.local` to your Vercel project settings.


## License

MIT - see [LICENSE](LICENSE).
