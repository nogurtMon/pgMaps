<div align="center">

<img src="public/Postgresql_elephant.png" height="48" />

# pgMaps

Open-source tool for managing maps and geospatial data in PostgreSQL

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

## Philosophy

pgMaps is built on a simple conviction: **geospatial data belongs in a database, not a bunch of files**.

Loading every shapefile, GeoJSON, etc. into PostgreSQL delivers one core benefit: standardization. With all your data in one place and one structure, it's far easier to view, process, edit, analyze and share.

---

## Features
- **Easily load spatial files into your PostgreSQL database**
  - Supports CSV, GeoJSON, GeoPackage, KML, Shapefile (SHP), and XLSX
  - Import directly from ArcGIS Feature Servers
  - Up to 1 GB per file
- **Visualize and edit geospatial data at scale**
  - Highly performant large-scale rendering powered by [Deck.gl](https://deck.gl)
- **Create, manage, and share live maps**

---

## Quick Start

**Requirements:** [Docker](https://docs.docker.com/get-started/get-docker/), a PostgreSQL/PostGIS database

Don't have a PostgreSQL database yet? [Neon](https://neon.tech) offers a free, serverless Postgres instance with PostGIS available as an extension — ready in about a minute, no installation required.

### Getting Started with Railway (Fastest)

Prefer a hosted setup?
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/pgmaps)

### Getting Started with Docker

Generate an encryption key to set as an environment variable.

```bash
openssl rand -hex 32
```

Run the command below, filling in environment variables. Values are single-quoted — keep them that way, since strong passwords and keys often contain characters like `&`, `!`, or `$` that an unquoted shell will interpret instead of passing through.

```bash
docker run -d \
  -p 3000:8080 \
  -e POSTGRES_URL='postgresql://user:password@host/dbname' \
  -e APP_PASSWORD='your-strong-password' \
  -e DSN_ENCRYPTION_KEY='paste-your-generated-key-here' \
  -v app_data:/data \
  nogurtmon1/pg-maps:latest
```

If your PostgreSQL database runs on the same machine (not in a container), `host` above won't resolve from inside the container. Add `--add-host=host.docker.internal:host-gateway` to the command and use `host.docker.internal` as the host in `POSTGRES_URL`.

Open `http://localhost:3000`. If the page doesn't load, run `docker ps` to confirm the container is `Up`, and `docker logs <container>` to see why.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | **Yes** | Your PostgreSQL connection string. By default, the app will create up to four tables in the public schema (_pgmaps_basemaps, _pgmaps_connections, _pgmaps_folders, _pgmaps_maps) to store its own data. |
| `APP_PASSWORD` | **Yes** | Password protecting the app. Without it, anyone with the URL could obtain read/write access to your PostgreSQL database. |
| `DSN_ENCRYPTION_KEY` | **Yes** | 32-byte hex key used to encrypt saved connection strings at rest. Generate with `openssl rand -hex 32`. |
| `PORT` | No | Port the app listens on. Defaults to `3000` when running from source, but the published Docker image fixes it to `8080` internally — change the `-p` host mapping in `docker run` (e.g. `-p 3000:8080`) rather than this variable. |
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