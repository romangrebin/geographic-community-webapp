# Local dev setup

- **Node version:** Next 16.2.3 needs Node 20.9 or newer. Some dev tools need more: vite 8, rolldown and eslint-visitor-keys want 22.12 or newer. The machine's default nvm Node is 18.20.4, which fails. Node 24 works for everything.
  - The repo has no `.nvmrc` or `engines` field, so nothing selects the right version automatically.
  - The workaround used on 2026-11-24 was to prefix commands with the Node 24 path, e.g. `PATH=~/.nvm/versions/node/v24.21.0/bin:$PATH npm run dev`.
- **Fresh checkout:** `node_modules` isn't committed. Run `npm ci` (it installs exactly what `package-lock.json` lists) before `npm run dev`. Without it you get `Cannot find module .../next/dist/bin/next`.
- **Database:** `.env.local` points at the real Supabase project, so the local dev server reads and writes production data (see the project CLAUDE.md rule).
- **npm audit:** as of 2026-11-24 it reports 24 vulnerabilities, 2 of them critical. Not looked into yet.
