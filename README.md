<div align="center">

<img src="public/Postgresql_elephant.png" height="48" />

# pgMaps

Open-source tool for managing maps and geospatial data in PostGIS-enabled PostgreSQL databases

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/pgmaps)

</div>

## Philosophy

pgMaps is built on a simple conviction: **geospatial data belongs in a database, not a bunch of files**.

Loading every shapefile, GeoJSON, and everything else into PostgreSQL delivers one core benefit: standardization. With all your data in one place and one structure, it's far easier to view, edit, analyze, manage, and share.

---

## Features
- **Easily load spatial files into your PostgreSQL database**
  - Supports CSV, GeoJSON, GeoPackage, KML, Shapefile (SHP), and XLSX
  - Imports directly from ArcGIS Feature Servers
  - Up to 1 GB per file
- **Visualize and edit geospatial data at scale**
  - Highly performant large-scale rendering powered by [Deck.gl](https://deck.gl)
- **Create, manage, and share live maps**

---

## Quick Start

**Requirements:** [Docker](https://docs.docker.com/get-started/get-docker/), a PostgreSQL/PostGIS database

Don't have a PostgreSQL database yet? [Neon](https://neon.tech) offers a free, serverless Postgres instance with PostGIS available as an extension — ready in about a minute, no installation required.

Prefer a hosted setup? [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/pgmaps) deploys the same Docker image — you'll be prompted for the three required env vars below during setup.

Generate an encryption key once and hold onto it — you'll pass the same one every time you start the container:

```bash
openssl rand -hex 32
```

```bash
docker run -d \
  -p 3000:3000 \
  -e POSTGRES_URL=postgresql://user:password@host/dbname \
  -e APP_PASSWORD=your-strong-password \
  -e DSN_ENCRYPTION_KEY=<the key you generated above> \
  -v app_data:/data \
  nogurtmon1/pg-maps:latest
```

Open `http://localhost:3000`.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | **Yes** | Your PostgreSQL connection string. By default, the app will create up to four tables in the public schema (_pgmaps_basemaps, _pgmaps_connections, _pgmaps_folders, _pgmaps_maps) to store its own data. |
| `APP_PASSWORD` | **Yes** | Password protecting the app. Without it, anyone with the URL could obtain read/write access to your PostgreSQL database. |
| `DSN_ENCRYPTION_KEY` | **Yes** | 32-byte hex key used to encrypt saved connection strings at rest. Generate with `openssl rand -hex 32`. |
| `PORT` | No | Port the app listens on. Defaults to `3000`. |
| `SHOW_LANDING_PAGE` | No | Set to any value to show the landing page at `/`. Otherwise `/` redirects to `/maps`. |

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](.github/CONTRIBUTING.md#running-locally) for running the app from source. Please open an issue first for significant changes.

---

## Stack

| | |
|---|---|
| Framework | Next.js |
| Map | MapLibre GL + Deck.gl |
| Tiles | PostGIS `ST_AsMVT` |
| Database client | node-postgres |
| UI | shadcn/ui + Tailwind CSS |