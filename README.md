# <img src="public/Postgresql_elephant.png" height="32" align="center" />   PostGIS Frontend

**An open-source web interface for PostGIS databases**. Import spatial data from any format into PostGIS, create live interactive maps and share them with anyone. Runs locally or self-hosted.

![PostGIS Frontend screenshot](public/screenshot1.png)

**Live Demo**

[▶ See the full workflow in action](https://www.loom.com/share/b970709d7b2e4c4e9d06bda12524a6c1) — how to create and share a live map, start to finish. (4 min)

- Connect to any PostGIS database directly from the browser
- Import anything (ArcGIS Feature Server, GeoPackage, GeoJSON, KML, SHP, CSV, XLSX)
- Visualize large spatial datasets
- Share live maps with anyone

---

# Self Hosting

### Docker

**Requirements:** Docker

**1. Install Docker**

- **Mac / Windows** — download and install [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER && newgrp docker
  ```
  > `newgrp docker` applies the group change to your current session. Log out and back in to make it permanent.

**2. Clone and run**

```bash
git clone https://github.com/nogurtMon/postgis-frontend.git && cd postgis-frontend && docker compose up -d --build
```

Open `http://localhost:3000`.

> By default the app has no password — anyone with the URL can use it. To require a password, create a `.env` file with `APP_PASSWORD=yourpassword`. To use a different port, add `PORT=8080`.

**Update:**

```bash
git pull && docker compose down && docker compose up -d --build
```

---

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nogurtMon/postgis-frontend&env=DSN_ENCRYPTION_KEY,APP_PASSWORD,POSTGRES_URL&envDescription=DSN_ENCRYPTION_KEY%3A%20run%20%60node%20-e%20%22console.log(require('crypto').randomBytes(32).toString('hex'))%22%60%20to%20generate.%20APP_PASSWORD%3A%20password%20to%20access%20the%20app.%20POSTGRES_URL%3A%20Postgres%20connection%20string%20for%20app%20storage%20%E2%80%94%20create%20a%20free%20database%20at%20neon.tech.&envLink=https://github.com/nogurtMon/postgis-frontend%23environment-variables)

Click the button, fill in your three environment variables, and Vercel handles the rest. You'll need a PostgreSQL database; [Neon](https://neon.tech) offers a free tier that works out of the box.

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

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DSN_ENCRYPTION_KEY` | Yes (Vercel) | 64 hex chars. Encrypts database connection strings at rest. Auto-generated in Docker. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_PASSWORD` | Recommended | Protects the app at `/map` with a password. Without it, anyone who finds the URL can connect databases and read or write your data. Public share links at `/share/[id]` remain accessible regardless. |
| `POSTGRES_URL` | Yes (Vercel / Local) | Postgres connection string for the app's own storage (connections, saved views). Auto-configured in Docker. The app creates its tables automatically on first request. |
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
