import { Pool } from "pg";

export interface BasemapEntry {
  id: string;
  name: string;
  styleUrl: string;
  createdAt: string;
}

export const SEED_BASEMAPS: { id: string; name: string; styleUrl: string }[] = [
  { id: "liberty",  name: "Liberty",  styleUrl: "https://tiles.openfreemap.org/styles/liberty"  },
  { id: "bright",   name: "Bright",   styleUrl: "https://tiles.openfreemap.org/styles/bright"   },
  { id: "positron", name: "Positron", styleUrl: "https://tiles.openfreemap.org/styles/positron" },
  { id: "dark",     name: "Dark",     styleUrl: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
  { id: "fiord",    name: "Fiord",    styleUrl: "https://tiles.openfreemap.org/styles/fiord"    },
];

function getStorageUrl(): string {
  const url = process.env.POSTGRES_URL ?? process.env.STORAGE_DB_URL;
  if (!url) throw new Error("No storage database configured. Set POSTGRES_URL in your environment.");
  return url;
}

let _pool: Pool | null = null;
let _ready = false;

function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: getStorageUrl(), max: 3 });
  return _pool;
}

async function ensureTable(): Promise<void> {
  if (_ready) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS _postgis_frontend_basemaps (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      style_url  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  for (const b of SEED_BASEMAPS) {
    await getPool().query(
      `INSERT INTO _postgis_frontend_basemaps (id, name, style_url)
       VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [b.id, b.name, b.styleUrl]
    );
  }
  _ready = true;
}

function newId(): string {
  const { randomBytes } = require("crypto");
  return randomBytes(8).toString("base64url");
}

export async function listBasemaps(): Promise<BasemapEntry[]> {
  await ensureTable();
  const { rows } = await getPool().query(
    `SELECT id, name, style_url, created_at FROM _postgis_frontend_basemaps ORDER BY created_at ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    styleUrl: r.style_url,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function addBasemap(name: string, styleUrl: string, id?: string): Promise<BasemapEntry> {
  await ensureTable();
  const resolvedId = id ?? newId();
  const { rows } = await getPool().query(
    `INSERT INTO _postgis_frontend_basemaps (id, name, style_url) VALUES ($1, $2, $3) RETURNING created_at`,
    [resolvedId, name.trim(), styleUrl.trim()]
  );
  return { id: resolvedId, name: name.trim(), styleUrl: styleUrl.trim(), createdAt: rows[0].created_at.toISOString() };
}

export async function updateBasemap(id: string, name: string, styleUrl: string): Promise<void> {
  await ensureTable();
  const { rowCount } = await getPool().query(
    `UPDATE _postgis_frontend_basemaps SET name = $2, style_url = $3 WHERE id = $1`,
    [id, name.trim(), styleUrl.trim()]
  );
  if (!rowCount) throw new Error("Basemap not found");
}

export async function deleteBasemap(id: string): Promise<void> {
  await ensureTable();
  await getPool().query(`DELETE FROM _postgis_frontend_basemaps WHERE id = $1`, [id]);
}

export async function restoreDefaults(): Promise<void> {
  await ensureTable();
  for (const b of SEED_BASEMAPS) {
    await getPool().query(
      `INSERT INTO _postgis_frontend_basemaps (id, name, style_url)
       VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [b.id, b.name, b.styleUrl]
    );
  }
}
