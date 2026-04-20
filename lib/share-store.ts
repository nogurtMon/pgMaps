import { Pool } from "pg";

// Shares are saved views with is_public = TRUE.
// This module is a thin layer over _postgis_frontend_saved_views.

export interface ViewIndexEntry {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

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
  _ready = true;
}

// Returns state_json merged with connectionId so resolveShareDsn can find it.
export async function getShare(id: string): Promise<Record<string, any> | null> {
  await ensureTable();
  const { rows } = await getPool().query(
    `SELECT state_json, connection_id FROM _postgis_frontend_saved_views WHERE id = $1 AND is_public = TRUE`,
    [id]
  );
  if (!rows[0]) return null;
  return { ...rows[0].state_json, connectionId: rows[0].connection_id };
}

// Upserts a public view. connectionId must be in config; it is stored in the column, not in state_json.
export async function setShare(id: string, name: string, config: Record<string, any>, _isNew: boolean, _now: string): Promise<void> {
  await ensureTable();
  const { connectionId, ...stateJson } = config;
  if (!connectionId) throw new Error("Share config missing connectionId");
  await getPool().query(
    `INSERT INTO _postgis_frontend_saved_views (id, connection_id, name, state_json, is_public)
     VALUES ($1, $2, $3, $4::jsonb, TRUE)
     ON CONFLICT (id) DO UPDATE
       SET name       = EXCLUDED.name,
           state_json = EXCLUDED.state_json,
           is_public  = TRUE,
           updated_at = NOW()`,
    [id, connectionId, name, JSON.stringify(stateJson)]
  );
}

// Unpublishes the view (keeps the saved view row, just makes it private).
export async function deleteShare(id: string): Promise<void> {
  await ensureTable();
  await getPool().query(
    `UPDATE _postgis_frontend_saved_views SET is_public = FALSE WHERE id = $1`, [id]
  );
}

export async function listShares(): Promise<ViewIndexEntry[]> {
  await ensureTable();
  const { rows } = await getPool().query(
    `SELECT id, name, created_at, updated_at FROM _postgis_frontend_saved_views WHERE is_public = TRUE ORDER BY created_at DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }));
}
