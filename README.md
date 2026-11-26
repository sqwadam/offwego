# Journeys — Road trip stop planner (offwego.live)

Plan a road trip: pick a start point, click towns on the map, see drive times,
live hotels (Stay22), food (Google Maps) and activities (Klook) for each stop,
and keep every booking document with the trip.

- Web app: Vite + React + TypeScript + Tailwind (in `web/`)
- Backend: Supabase (in `backend/` — SQL migrations, row-level security, storage)
- Live site: https://offwego.live

## Run it

```sh
bun install
cp .env.example web/.env   # then fill in your values
bun run dev                # from web/
```

Run `node scripts/restore-binaries.mjs` once after cloning — it decodes the
binary assets (app icons, `web/public/towns-data.json`) that are stored
base64/gzip-compressed to fit GitHub's push limit.

## Environment variables (web/.env)

| Name | What it is |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL, e.g. `https://tzybzbahhonxpdbjmova.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key — public by design |
| `VITE_STAY22_AID` | Stay22 affiliate aid for the live hotel maps |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | Google Maps JS API key (maps embed) |

Secrets (service keys, Google OAuth client secret) never go in client env files.

## Supabase setup

1. Create a project, then run the SQL in `backend/migrations/` in order
   (`0001_planner.sql`, `0002_documents.sql`) in the dashboard SQL editor —
   they create the trips and document tables, row-level security and the
   private `documents` bucket.
2. Authentication → URL Configuration: set Site URL to your domain and add it
   to the redirect allow-list.
3. Google sign-in: enable the Google provider with your OAuth client, whose
   authorized redirect URI is `https://<your-project-ref>.supabase.co/auth/v1/callback`.

## Deployment

Any static host works (`bun run build` from `web/` outputs `dist/`).
The live site is served by Rork at offwego.live.
