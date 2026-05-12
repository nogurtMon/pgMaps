import { Pool } from "pg";
import { encryptDsn, decryptDsn } from "./dsn-token";

export interface ConnectionEntry {
  id: string;
  name: string;
  host: string;
  database: string;
  createdAt: string;
}

function parseHostDb(dsn: string): { host: string; database: string } {
  try {
    const url = new URL(dsn);
    return { host: url.hostname || "localhost", database: url.pathname.replace(/^\//, "") || "postgres" };
  } catch {
    return { host: "unknown", database: "unknown" };
  }
}

function newId(): string {
  const { randomBytes } = require("crypto");
  return randomBytes(8).toString("base64url");
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

export const LOCAL_CONNECTION_ID = "local";

async function ensureTable(): Promise<void> {
  if (_ready) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS _postgis_frontend_connections (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      host          TEXT NOT NULL,
      database      TEXT NOT NULL,
      encrypted_dsn TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Ensure PostGIS is enabled on the built-in database (safe no-op if already installed).
  await getPool().query(`CREATE EXTENSION IF NOT EXISTS postgis`).catch(() => {});

  // Always ensure the built-in database is registered as a connection.
  const storageUrl = getStorageUrl();
  const { host, database } = parseHostDb(storageUrl);
  await getPool().query(
    `INSERT INTO _postgis_frontend_connections (id, name, host, database, encrypted_dsn)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       host = EXCLUDED.host,
       database = EXCLUDED.database,
       encrypted_dsn = EXCLUDED.encrypted_dsn`,
    [LOCAL_CONNECTION_ID, "Built-in Database", host, database, encryptDsn(storageUrl)]
  );
  _ready = true;
}

export async function listConnections(): Promise<ConnectionEntry[]> {
  await ensureTable();
  const { rows } = await getPool().query(
    `SELECT id, name, host, database, created_at FROM _postgis_frontend_connections ORDER BY created_at DESC`
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, host: r.host, database: r.database,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function getConnection(id: string): Promise<string> {
  await ensureTable();
  const { rows } = await getPool().query(
    `SELECT encrypted_dsn FROM _postgis_frontend_connections WHERE id = $1`, [id]
  );
  if (!rows[0]) throw new Error("Connection not found");
  return decryptDsn(rows[0].encrypted_dsn);
}

export async function addConnection(name: string, rawDsn: string): Promise<ConnectionEntry> {
  await ensureTable();
  const id = newId();
  const { host, database } = parseHostDb(rawDsn);
  const { rows } = await getPool().query(
    `INSERT INTO _postgis_frontend_connections (id, name, host, database, encrypted_dsn)
     VALUES ($1, $2, $3, $4, $5) RETURNING created_at`,
    [id, name.trim(), host, database, encryptDsn(rawDsn)]
  );
  return { id, name: name.trim(), host, database, createdAt: rows[0].created_at.toISOString() };
}

export async function renameConnection(id: string, name: string): Promise<void> {
  await ensureTable();
  const { rowCount } = await getPool().query(
    `UPDATE _postgis_frontend_connections SET name = $2 WHERE id = $1`, [id, name.trim()]
  );
  if (!rowCount) throw new Error("Connection not found");
}

export async function updateConnection(id: string, name: string, rawDsn?: string): Promise<void> {
  await ensureTable();
  if (rawDsn) {
    const { host, database } = parseHostDb(rawDsn);
    const { rowCount } = await getPool().query(
      `UPDATE _postgis_frontend_connections SET name = $2, host = $3, database = $4, encrypted_dsn = $5 WHERE id = $1`,
      [id, name.trim(), host, database, encryptDsn(rawDsn)]
    );
    if (!rowCount) throw new Error("Connection not found");
  } else {
    await renameConnection(id, name);
  }
}

export async function deleteConnection(id: string): Promise<void> {
  await ensureTable();
  await getPool().query(`DELETE FROM _postgis_frontend_connections WHERE id = $1`, [id]);
}
