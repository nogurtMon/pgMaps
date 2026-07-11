import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

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
  // Migrate from old table names if they exist.
  await getPool().query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_postgis_frontend_saved_views')
         AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_postgis_frontend_maps')
         AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_pgmaps_maps')
      THEN
        ALTER TABLE _postgis_frontend_saved_views RENAME TO _pgmaps_maps;
      ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_postgis_frontend_maps')
         AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_pgmaps_maps')
      THEN
        ALTER TABLE _postgis_frontend_maps RENAME TO _pgmaps_maps;
      END IF;
    END $$
  `);
  await getPool().query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_postgis_frontend_folders')
         AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_pgmaps_folders')
      THEN
        ALTER TABLE _postgis_frontend_folders RENAME TO _pgmaps_folders;
      END IF;
    END $$
  `);
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS _pgmaps_maps (
      id            TEXT        PRIMARY KEY,
      connection_id TEXT        NOT NULL,
      name          TEXT        NOT NULL,
      state_json    JSONB       NOT NULL,
      is_public     BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await getPool().query(`
    ALTER TABLE _pgmaps_maps
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await getPool().query(`
    ALTER TABLE _pgmaps_maps
      ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS _pgmaps_folders (
      id         TEXT        PRIMARY KEY,
      name       TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await getPool().query(`
    ALTER TABLE _pgmaps_maps
      ADD COLUMN IF NOT EXISTS folder_id TEXT
        REFERENCES _pgmaps_folders(id) ON DELETE SET NULL
  `);
  await getPool().query(`
    ALTER TABLE _pgmaps_maps
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
  `);
  await getPool().query(`
    ALTER TABLE _pgmaps_folders
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
  `);
  await getPool().query(`
    ALTER TABLE _pgmaps_maps
      ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE
  `);
  _ready = true;
}

// GET /api/pg/saved-views?archived=false
export async function GET(req: NextRequest) {
  const showArchived = req.nextUrl.searchParams.get("archived") === "true";
  try {
    await ensureTable();
    const { rows } = await getPool().query(
      `SELECT id, connection_id, name, state_json, is_public, archived, folder_id, sort_order, is_template, created_at, updated_at
       FROM _pgmaps_maps
       WHERE archived = $1
       ORDER BY sort_order, updated_at DESC`,
      [showArchived]
    );
    return NextResponse.json({ views: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/pg/saved-views  { connectionId, id, name, state }
export async function POST(req: NextRequest) {
  const { connectionId, id, name, state, folder_id } = await req.json();
  if (!connectionId || !id || !name?.trim()) return NextResponse.json({ error: "connectionId, id, and name are required" }, { status: 400 });
  try {
    await ensureTable();
    await getPool().query(
      `INSERT INTO _pgmaps_maps (id, connection_id, name, state_json, folder_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, connectionId, name.trim(), JSON.stringify(state), folder_id ?? null]
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
