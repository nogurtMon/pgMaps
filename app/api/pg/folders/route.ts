import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

function getStorageUrl(): string {
  const url = process.env.POSTGRES_URL ?? process.env.STORAGE_DB_URL;
  if (!url) throw new Error("No storage database configured.");
  return url;
}

let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: getStorageUrl(), max: 3 });
  return _pool;
}

async function ensureTables(): Promise<void> {
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
    CREATE TABLE IF NOT EXISTS _pgmaps_folders (
      id         TEXT        PRIMARY KEY,
      name       TEXT        NOT NULL,
      sort_order INTEGER     NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await getPool().query(`
    ALTER TABLE _pgmaps_folders
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
  `);
  await getPool().query(`
    ALTER TABLE _pgmaps_maps
      ADD COLUMN IF NOT EXISTS folder_id TEXT
        REFERENCES _pgmaps_folders(id) ON DELETE SET NULL
  `);
}

// GET /api/pg/folders — list all folders with map counts
export async function GET() {
  try {
    await ensureTables();
    const { rows } = await getPool().query(`
      SELECT f.id, f.name, f.sort_order, f.created_at, f.updated_at,
             COUNT(m.id) FILTER (WHERE m.archived = FALSE) AS map_count
      FROM _pgmaps_folders f
      LEFT JOIN _pgmaps_maps m ON m.folder_id = f.id
      GROUP BY f.id, f.name, f.sort_order, f.created_at, f.updated_at
      ORDER BY f.sort_order, f.name
    `);
    return NextResponse.json({ folders: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/pg/folders  { id, name }
export async function POST(req: NextRequest) {
  const { id, name } = await req.json();
  if (!id || !name?.trim()) return NextResponse.json({ error: "id and name required" }, { status: 400 });
  try {
    await ensureTables();
    await getPool().query(
      `INSERT INTO _pgmaps_folders (id, name) VALUES ($1, $2)`,
      [id, name.trim()]
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
