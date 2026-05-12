import { Pool } from "pg";
import { createHash } from "crypto";

export interface ViewIndexEntry {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShareGetResult {
  config: Record<string, any> | null;
  requiresPassword: boolean;
  isExpired: boolean;
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
  await getPool().query(`ALTER TABLE _postgis_frontend_saved_views ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE`);
  await getPool().query(`ALTER TABLE _postgis_frontend_saved_views ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`);
  await getPool().query(`ALTER TABLE _postgis_frontend_saved_views ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await getPool().query(`ALTER TABLE _postgis_frontend_saved_views ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
  _ready = true;
}

export function hashPassword(id: string, password: string): string {
  return createHash("sha256").update(`${id}:${password}:postgis-share`).digest("hex");
}

export async function getShare(id: string, password?: string): Promise<ShareGetResult> {
  await ensureTable();
  const { rows } = await getPool().query(
    `SELECT state_json, connection_id, password_hash, expires_at
     FROM _postgis_frontend_saved_views WHERE id = $1 AND is_public = TRUE`,
    [id]
  );
  if (!rows[0]) return { config: null, requiresPassword: false, isExpired: false };

  const row = rows[0];

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { config: null, requiresPassword: false, isExpired: true };
  }

  if (row.password_hash) {
    if (!password) return { config: null, requiresPassword: true, isExpired: false };
    if (hashPassword(id, password) !== row.password_hash) {
      return { config: null, requiresPassword: true, isExpired: false };
    }
  }

  return {
    config: { ...row.state_json, connectionId: row.connection_id },
    requiresPassword: false,
    isExpired: false,
  };
}

export async function setShare(
  id: string,
  name: string,
  config: Record<string, any>,
  _isNew: boolean,
  _now: string,
  passwordHash?: string | null,
  expiresAt?: string | null
): Promise<void> {
  await ensureTable();
  const { connectionId, ...stateJson } = config;
  if (!connectionId) throw new Error("Share config missing connectionId");
  await getPool().query(
    `INSERT INTO _postgis_frontend_saved_views
       (id, connection_id, name, state_json, is_public, password_hash, expires_at)
     VALUES ($1, $2, $3, $4::jsonb, TRUE, $5, $6)
     ON CONFLICT (id) DO UPDATE
       SET name          = EXCLUDED.name,
           state_json    = EXCLUDED.state_json,
           is_public     = TRUE,
           password_hash = EXCLUDED.password_hash,
           expires_at    = EXCLUDED.expires_at,
           updated_at    = NOW()`,
    [id, connectionId, name, JSON.stringify(stateJson), passwordHash ?? null, expiresAt ?? null]
  );
}

export async function deleteShare(id: string): Promise<void> {
  await ensureTable();
  await getPool().query(
    `UPDATE _postgis_frontend_saved_views SET is_public = FALSE WHERE id = $1`,
    [id]
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
