# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server with Turbopack (localhost:3000)
npm run build      # Production build (Turbopack)
npm run start      # Start production server
```

No test suite is configured. Type-check with `npx tsc --noEmit`.

### Turbopack: routes returning 404

If existing API routes suddenly return 404 HTML pages (the Next.js 404 page, not a JSON error), Turbopack's hot-reload has gotten into a bad state. Fix: kill the dev server and run `rm -rf .next && npm run dev`. This clears the compiled output and forces a clean rebuild.

## Environment Variables

- `POSTGRES_URL` — required; connection string for the app's own storage database (saved connections, maps, basemap configs)
- `APP_PASSWORD` — required; single-user password for login
- `DSN_ENCRYPTION_KEY` — required; 32-byte hex key for AES-256-GCM encryption of connection strings. No fallback — the app throws on startup if unset
- `PORT` — optional; defaults to 3000
- `SHOW_LANDING_PAGE` — if set, renders the marketing page at `/`; otherwise `/` redirects to `/maps`

## Architecture

This is a **self-hosted PostGIS web UI**: browse PostGIS tables, style them on a map, filter rows, and share views with a public URL. Data never leaves the user's own database.

### Pages (`app/`)

| Route | Purpose |
|---|---|
| `/` | Marketing landing (only if `SHOW_LANDING_PAGE` set) |
| `/login` | Single-user password auth |
| `/maps` | List of saved map views |
| `/map?view=<id>` | Main map editor |
| `/share/[id]` | Public read-only shared view |

### API Routes (`app/api/`)

**`/api/pg/*`** — All PostGIS operations. Every route decrypts the connection DSN from the session token (`lib/resolve-dsn.ts`), gets a pooled pg client (`lib/pool.ts`), and runs SQL.

Key routes:
- `tiles/` — `ST_AsMVT` tile endpoint consumed by deck.gl `MVTLayer`
- `table-rows/` — paginated, searchable row fetch (full-text search via `ILIKE` across all text columns)
- `bulk-insert/` — client-side parsed GeoJSON/Shapefile/CSV/Excel → PostGIS rows
- `import-arcgis/` — SSE streaming import from ArcGIS Feature Server
- `create-table/`, `drop-table/`, `truncate-table/` — DDL
- `alter-column/`, `rename-table/`, `add-primary-key/`, `create-spatial-index/`, `cluster-table/`, `assign-srid/`, `cast-geometry-type/` — table management DDL
- `extent/`, `columns/`, `tables/`, `table-info/`, `saved-views/` — introspection

**`/api/connections/*`** — CRUD for saved DB connections. DSNs are encrypted with AES-256-GCM before storage (`lib/connections-store.ts`).

**`/api/share/*`** — Saved share view CRUD (`lib/share-store.ts`).

**`/api/basemaps/*`** — Custom basemap CRUD (`lib/basemaps-store.ts`).

### Core Libraries (`lib/`)

- `pool.ts` — Per-DSN pg connection pools (keyed by connection string, lives for process lifetime)
- `resolve-dsn.ts` — Resolves connectionId/shareId/token → plain DSN. Has a 60-second in-process TTL cache (`dsnCache`). Call `evictDsnCache(id)` after connection update/delete; it is also called automatically by the tile route when a query fails with 42P01.
- `dsn-token.ts` — Issues/verifies encrypted session tokens
- `tile-cache.ts` — In-memory MVT tile cache with invalidation
- `geo-parse-utils.ts` — GeoJSON/WKB/WKT conversion utilities
- `wkb.ts` — WKB binary parser
- `types.ts` — Shared TypeScript types

### Recurring 42P01 tile errors ("relation does not exist")

When tiles log `[tiles pg-err] code: '42P01'`, check the `db:` field in the log — it shows the hostname of the database being queried. The error means the connection for that layer's `connectionId` is pointed at a database that doesn't contain the requested table. Common causes:

1. **Wrong connectionId saved with the layer** — the layer's `connectionId` in the saved view doesn't match the connection where the table lives. Load the map, switch to the correct connection in the Browser tab, re-add the layer, re-save. Each layer stores the `connectionId` from whichever connection was active in the Browser panel when the table was added — adding a table from connection A while connection B is selected results in the layer being bound to connection A's database.
2. **Stale DSN cache** — before the 60s TTL fix, if a connection's DSN changed (edited or environment variable updated), the old DSN stayed cached indefinitely. The TTL now ensures stale entries refresh within 60 seconds.
3. **Multiple Next.js workers** — in production with PM2/cluster, each worker has its own `dsnCache`. After editing a connection, workers that didn't handle the PUT request keep the old DSN until TTL expiry.

The tile route retries once on 42P01 (clearing the column cache) and calls `evictDsnCache` if the retry also fails, so the next request re-resolves from storage.

### Main Components

- `components/maplibre-map.tsx` — Core map editor (~2300 lines). Uses `@vis.gl/react-maplibre` (react-map-gl v8), deck.gl `MapboxOverlay` with `MVTLayer` for tile rendering, `mapbox-gl-draw` for geometry editing. Key patterns:
  - `reuseMaps` prop is set on the Map — on client-nav the map instance is reused, which causes `onLoad` to fire synchronously before `mapRef.current` is set. Always use `evt?.target` to get the live map in the `onLoad` callback, not `mapRef.current`.
  - Guards before adding controls/sources: `map.hasControl(overlay)`, `drawRef.current`, `map.getSource('_sel')` — prevent duplicate setup on reuse.
  - Cleanup effect removes `overlay` from map on unmount.
- `components/table-sidebar.tsx` — Sidebar (~2600 lines): table browser, layer style editor, filter builder, attribute table with paginated row display.
- `components/create-table-dialog.tsx` — Multi-tab import dialog: From File (GeoJSON/Shapefile/CSV/Excel), From ArcGIS, From Scratch.

### Workers

- `workers/xlsx-worker.ts` — XLSX parsing runs in a Web Worker to avoid blocking the main thread.

### Styling

Tailwind CSS v4 with shadcn/ui components. Dark mode supported via `next-themes`.

## Docker

`Dockerfile` uses `node:20-alpine` for all stages. Data directory mounted at `/app/data/shares`. The database is **not** bundled — users connect to their own PostGIS instance.