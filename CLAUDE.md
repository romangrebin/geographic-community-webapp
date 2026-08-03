# geographic.community

Map-first public directory for geographically-defined communities. Live at [geographic.community](https://geographic.community).

## Key commands

```bash
npm run dev       # start dev server at localhost:3000
npm run test      # run tests (vitest)
npm run build     # production build
npm run backup    # snapshot Supabase DB to backups/ as JSON
```

## Stack

- **Next.js** (App Router, TypeScript) + **Tailwind CSS v4**
- **MapLibre GL JS** for the map, **maplibre-gl-draw** for polygon drawing
- **Supabase** (Postgres + RLS) for database and auth (magic links)
- **Vercel** for deployment

## Running the app / touching the database

**Firm rule: never start the dev server, run `npm run dev`/`npm run build`/`npm run start`, or otherwise interact with the database (local or Supabase) unless the user *very explicitly* asks for it in that message.** `.env.local` points at a real Supabase project, and read/write API calls made while testing hit it directly — there is no separate sandbox. Don't do this proactively "to verify" a fix or reproduce a bug; propose it and wait for explicit go-ahead instead.

## Collaboration

When a bug or feature has more than one reasonable solution — especially anything touching UX, interaction design, or user-facing behavior — present the options with tradeoffs and get confirmation before implementing. Don't unilaterally pick an approach and build it. Purely mechanical fixes (dedup a constant, fix an off-by-one) don't need this.

## Architecture notes

- Data layer uses a repository pattern (`lib/repository.ts`) with adapters: `supabase.ts` (prod), `json-file.ts` (local dev fallback), `mock.ts` (tests)
- All map page state is a `useReducer` state machine in `app/useMapPageState.ts`
- Write operations use the service role key server-side; RLS restricts direct client writes
- Env vars go in `.env.local` — see README for the full list
