# Contributing

Thanks for your interest in contributing to pgMaps.

## Running locally

```bash
git clone https://github.com/nogurtMon/pgMaps.git
cd pgMaps
npm install
cp .env.example .env   # fill in your values
npm run dev
```

Open `http://localhost:3000`.

`POSTGRES_URL`, `APP_PASSWORD`, and `DSN_ENCRYPTION_KEY` are all required — there's no auto-generation fallback for any of them. Generate `DSN_ENCRYPTION_KEY` with `openssl rand -hex 32`.

## Project structure

| Path | What lives here |
|---|---|
| `app/` | Next.js App Router pages and API routes |
| `components/` | React UI components |
| `lib/` | Shared server-side logic (connection store, share store, DSN resolution) |
| `public/` | Static assets |

## Making changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Test locally — if touching the map, test tile rendering, share links, and the attribute table
4. Open a pull request with a clear description of what changed and why

## API routes

All PostGIS queries go through `app/api/pg/`. Tile generation uses `ST_AsMVT`. DSN resolution for all routes goes through `lib/resolve-dsn.ts` — if you add a new data endpoint, use `resolveDsnFromRequest` there rather than accepting raw connection strings from the client.

## Reporting security issues

Please see [SECURITY.md](SECURITY.md) before opening a public issue for a vulnerability.
