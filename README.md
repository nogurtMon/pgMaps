# PostGIS Frontend

<img src="public/postgres-frontend-logo1.png" width="300" />

A web interface for PostGIS databases.

- Import anything (Shapefile, GeoJSON, CSV, ArcGIS Feature Servers, etc.)
- Visualize large datasets without lag
- Share live maps with anyone

Connect to any PostGIS-enabled PostgreSQL database and manage your spatial data directly from the browser.

Includes table management tools to optimize tiling performance and scripts to import GeoJSON, Shapefile (.shp), CSV, KML, GeoPackage, ArcGIS Feature Servers and other spatial formats directly into PostGIS.

This is a free and open-source software that you can run locally or self host on Docker or Vercel.

## Features

- **Import** — upload GeoJSON, Shapefile (.shp), CSV, KML, GeoPackage, and other spatial formats directly into PostGIS as new tables; or automatically scrape any ArcGIS Feature Server into PostGIS with a single URL
- **Visualize** — render points, lines, and polygons as vector tile layers on an interactive map
- **Style** — per-layer fill, stroke, opacity, radius; categorical, threshold, and numeric color rules
- **Filter** — attribute, temporal, numeric range, and categorical controls; filters are applied server-side at tile query time
- **Share** — generate public read-only share links that embed your layers, styles, and active filters; viewers get an interactive panel to toggle visibility, filter by category or time, zoom to features, and view attribute tables — no login required
- **Attribute table** — browse, search, sort, and filter any layer's data; zoom the map directly to any individual feature
- **Table management** — create spatial indexes, assign SRIDs, add primary keys, cast geometry types, and cluster tables for improved tile performance

---

## Deploy

---

### Local development

```bash
git clone https://github.com/nogurtMon/postgis-frontend.git
cd postgis-frontend
npm install
npm run dev
```

No `DSN_ENCRYPTION_KEY` needed — a key is auto-generated locally.

---

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nogurtMon/postgis-frontend&env=DSN_ENCRYPTION_KEY,APP_PASSWORD,POSTGRES_URL&envDescription=DSN_ENCRYPTION_KEY%3A%20run%20%60node%20-e%20%22console.log(require('crypto').randomBytes(32).toString('hex'))%22%60%20to%20generate.%20APP_PASSWORD%3A%20password%20to%20access%20the%20app.%20POSTGRES_URL%3A%20Postgres%20connection%20string%20for%20app%20storage%20%E2%80%94%20create%20a%20free%20database%20at%20neon.tech.&envLink=https://github.com/nogurtMon/postgis-frontend%23environment-variables)

Fill in all three env vars when prompted. Add a custom domain in your Vercel project settings.

**Generate a key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Persistent storage:**

The app requires a Postgres database to store saved connections, shared maps, and saved views. Add one before deploying:

1. In your Vercel project dashboard, go to **Storage → Create Database → Postgres (Neon)**
2. Connect it to your project — Vercel automatically injects `POSTGRES_URL` into your environment
3. Redeploy

No SQL setup needed. The app automatically creates the following tables on first request:

| Table | Contents |
|---|---|
| `_postgis_frontend_connections` | Saved database connections (DSNs encrypted at rest) |
| `_postgis_frontend_saved_views` | Saved map views (layers, styles, filters, camera position). Rows with `is_public = true` are accessible as public share links. |

---

### Docker

**Requirements:** Docker, Node.js (to generate the key)

```bash
# Install Docker (Linux)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Clone and configure
git clone https://github.com/nogurtMon/postgis-frontend.git
cd postgis-frontend
node -e "console.log('DSN_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))" > .env
echo "APP_PASSWORD=yourpassword" >> .env
echo "POSTGRES_URL=postgres://user:pass@host:5432/dbname" >> .env

# Run
docker compose up -d
```

Open `http://localhost:3000`.

> `newgrp docker` applies the group change to your current session. Log out and back in to make it permanent.

**Custom domain (HTTPS):** put it behind [Caddy](https://caddyserver.com):
```
your.domain.com {
    reverse_proxy localhost:3000
}
```

**Update:**
```bash
git pull && docker compose down && docker compose up -d --build
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DSN_ENCRYPTION_KEY` | Yes (production) | 64 hex chars. Encrypts database connection strings at rest. |
| `APP_PASSWORD` | Recommended | Password to access the app. Share links at `/share/[id]` remain public regardless. If unset, no auth is required. |
| `POSTGRES_URL` | Required | Postgres connection string for the app's own storage (connections, shares, saved views). The app creates its tables automatically on first request. On Vercel, injected automatically when you add a Neon Postgres database. |
| `PORT` | No | Default: `3000`. Docker only. |

---

### Security

Connection strings are AES-256-GCM encrypted before being stored.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 |
| Map | MapLibre GL + deck.gl |
| Tiles | PostGIS `ST_AsMVT` |
| Database client | node-postgres |
| UI | shadcn/ui + Tailwind CSS |
