# <img src="public/Postgresql_elephant.png" height="32" align="center" />   PostGIS Frontend

**An open-source web interface for PostGIS databases**. Import spatial data from any format into PostGIS, create live interactive maps and share them with anyone. Runs locally or self-hosted.

![PostGIS Frontend screenshot](public/screenshot1.png)

[▶ Watch demo](https://www.loom.com/share/72ae683acdd145118e60f5eef6476930)

- Connect to any PostGIS database directly from the browser
- Import anything (ArcGIS Feature Server, GeoPackage, GeoJSON, KML, SHP, CSV, XLSX)
- Visualize large spatial datasets
- Share live maps with anyone

## Features

- **Import** — upload GeoJSON, Shapefile (.shp), CSV, KML, GeoPackage, and other spatial formats directly into PostGIS as new tables or automatically scrape any ArcGIS Feature Server into PostGIS with a single URL
- **Visualize** — render points, lines, and polygons as vector tile layers on an interactive map
- **Style** — per-layer fill, stroke, opacity, radius; categorical, threshold, and numeric color rules
- **Filter** — attribute, temporal, numeric range, and categorical controls; filters are applied server-side at tile query time
- **Share** — generate public read-only share links that embed your layers, styles, and active filters into an interactive view of your GIS data
- **Attribute table** — browse, search, sort, and filter any layer's data; zoom the map directly to any individual feature
- **Table management** — create spatial indexes, assign SRIDs, add primary keys, cast geometry types, and cluster tables for improved tile performance

---

## Deploy

---

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nogurtMon/postgis-frontend&env=DSN_ENCRYPTION_KEY,APP_PASSWORD,POSTGRES_URL&envDescription=DSN_ENCRYPTION_KEY%3A%20run%20%60node%20-e%20%22console.log(require('crypto').randomBytes(32).toString('hex'))%22%60%20to%20generate.%20APP_PASSWORD%3A%20password%20to%20access%20the%20app.%20POSTGRES_URL%3A%20Postgres%20connection%20string%20for%20app%20storage%20%E2%80%94%20create%20a%20free%20database%20at%20neon.tech.&envLink=https://github.com/nogurtMon/postgis-frontend%23environment-variables)

The fastest way to get started. Click the button, fill in your three environment variables, and Vercel handles the rest. You'll need a PostgreSQL database; [Neon](https://neon.tech) offers a free tier that works out of the box.

---

### Local development

**1. Clone and install**

```bash
git clone https://github.com/nogurtMon/postgis-frontend.git
cd postgis-frontend
npm install
```

**2. Create a `.env.local` file**

```bash
cp .env.example .env.local   # or create it manually
```

Open `.env.local` and fill in your values:

```env
# Required — Postgres connection string for the app's own storage
# (encrypted connection strings and saved map views).
# This can be the same PostgreSQL instance your PostGIS data lives on,
# or a separate one — your call.
POSTGRES_URL=postgres://user:password@host:5432/dbname

# Required — 64-character hex key that encrypts stored database connection strings.
# Generate one with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DSN_ENCRYPTION_KEY=your64hexkey

# Strongly recommended — password to access the app at /map.
# Without it, anyone who finds the URL can read and write to your PostGIS databases.
# Share links at /share/[id] remain public regardless.
APP_PASSWORD=yourpassword
```

**3. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
| `DSN_ENCRYPTION_KEY` | Yes | 64 hex chars. Encrypts database connection strings at rest. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_PASSWORD` | Recommended | Protects the app at `/map` with a password. Without it, anyone who finds the URL can connect databases and read or write your data. Public share links at `/share/[id]` remain accessible regardless. |
| `POSTGRES_URL` | Required | Postgres connection string for the app's own storage (connections, saved views). The app creates its tables automatically on first request.|
| `PORT` | No | Default: `3000`. Docker only. |
| `SHOW_LANDING_PAGE` | No | If set, `/` shows the marketing landing page. Otherwise `/` redirects to `/map`. |

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
