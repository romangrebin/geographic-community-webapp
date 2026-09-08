# CARTO basemap API key

## What happened

Around late August 2026, CARTO started enforcing an API key on its public basemap CDN
(`basemaps.cartocdn.com`). Tile requests without a key are served a gray placeholder
tile stamped **"API KEY REQUIRED / carto.com/basemaps/apikey"**. Our code never changed —
CARTO changed their terms. The keyless `light_all` raster endpoint had been used
anonymously for years (README used to say "no account required").

Same break hit Home Assistant, Grafana Geomap, openHAB, PiAware, etc. in the same window.

## Fix in this repo

- `components/Map.tsx` uses a single tile URL:
  `https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png${cartoKeyParam}`
  where `cartoKeyParam` is `?key=${NEXT_PUBLIC_CARTO_API_KEY}` when the env var is set,
  else `''` (falls back to the keyless watermarked tile rather than `key=undefined`).
  - **Param is `key=`, not `api_key=`** (per CARTO's key-issue email).
  - Dropped the old `a.`/`b.`/`c.` subdomain sharding — pointless over HTTP/2, and the
    bare host is CARTO's canonical form now. Verified both work with the key.
  - `light_all` = Positron (light grey). Kept, to preserve the existing look. CARTO's
    email example used `rastertiles/voyager` but that's just their default style.
- Key lives only in env (`NEXT_PUBLIC_CARTO_API_KEY`), not in source. Must be
  `NEXT_PUBLIC_` because the map is a client component — it ships in the bundle, which
  is fine: CARTO basemap keys are designed to be public and are domain-restricted in
  the CARTO dashboard.
- Current key: `cb1_315v_1_dcbee6885203988e0cf382d7` (issued 2026-09-07, free tier),
  set in Vercel env for the project.
- Documented in `.env.local.example` and README env-var table.
- Privacy blurb in `components/CommunitySidebar.tsx` corrected from "OpenFreeMap" (was
  already wrong) to "CARTO".

## Verified (2026-09-07)

`curl` of `.../light_all/{z}/{x}/{y}.png` with no key returned the 20 KB watermarked
tile; the same URL with `?key=<key>` returned a clean 22 KB tile. Worked with and
without a `Referer` header, so the domain restriction won't break server/CDN fetches.

## Free tier

5M tile requests / month across raster + vector, self-serve at
<https://carto.com/basemaps/apikey/> (no approval queue). Restrict the key to
`geographic.community` (+ `localhost` for dev) in the CARTO dashboard.

## Deployment

`NEXT_PUBLIC_CARTO_API_KEY` is set in Vercel env for the project. Because it's a
`NEXT_PUBLIC_` var it's inlined at build time, so after changing it you must redeploy —
an env change alone doesn't rebuild. Add it to local `.env.local` for local dev.

## If CARTO's free tier ever becomes a problem

Switch to OpenFreeMap (`https://tiles.openfreemap.org/styles/positron`, vector, no key,
no limits) or self-hosted Protomaps `.pmtiles`. Positron look is near-identical.
