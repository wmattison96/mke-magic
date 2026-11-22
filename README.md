# MKE Magic

MKE Magic is a Next.js application for the six-member Magic: The Gathering playgroup. It provides public game history and statistics, member profiles and decks, authenticated game tracking, advanced analytics, and a member-only Play life tracker.

## Run locally

1. Install the project dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the existing Supabase project's public values.
4. Start Next.js with `npm run dev` and open `http://localhost:3000`.

`SUPABASE_DB_URL` is only for the local historical importer and database verification scripts. Do not add it to Vercel. Historical source CSVs are private local files and are not needed by the deployed app.

## Checks

```bash
npm test
npm run historical:check
npm run dashboard:baseline
npm run lint
npm run typecheck
npm run build
```

Hosted database verification and rollback-only authorization tests are also available as `npm run database:verify` and `npm run database:test:m3` when the local Supabase connection values are configured.

## Deployment

See [the production readiness and launch guide](docs/PRODUCTION_READINESS.md) for Vercel setup, domain DNS, Supabase Auth email settings, and the safe member-account mapping procedure. Deployment and account creation are intentionally manual.
