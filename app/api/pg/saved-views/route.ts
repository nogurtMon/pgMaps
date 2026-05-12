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
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS _postgis_frontend_saved_views (
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
    ALTER TABLE _postgis_frontend_saved_views
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await getPool().query(`
    ALTER TABLE _postgis_frontend_saved_views
      ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE
  `);
  _ready = true;
}

// GET /api/pg/saved-views?connectionId=ID&archived=false
export async function GET(req: NextRequest) {
  const connectionId = req.nextUrl.searchParams.get("connectionId");
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  const showArchived = req.nextUrl.searchParams.get("archived") === "true";
  try {
    await ensureTable();
    const { rows } = await getPool().query(
      `SELECT id, name, state_json, is_public, archived, created_at, updated_at
       FROM _postgis_frontend_saved_views
       WHERE connection_id = $1 AND archived = $2
       ORDER BY updated_at DESC`,
      [connectionId, showArchived]
    );
    return NextResponse.json({ views: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/pg/saved-views  { connectionId, id, name, state }
export async function POST(req: NextRequest) {
  const { connectionId, id, name, state } = await req.json();
  if (!connectionId || !id || !name?.trim()) return NextResponse.json({ error: "connectionId, id, and name are required" }, { status: 400 });
  try {
    await ensureTable();
    await getPool().query(
      `INSERT INTO _postgis_frontend_saved_views (id, connection_id, name, state_json)
       VALUES ($1, $2, $3, $4)`,
      [id, connectionId, name.trim(), JSON.stringify(state)]
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
