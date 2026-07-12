import { Pool } from "pg";
import { encryptDsn, decryptDsn, needsReencrypt } from "./dsn-token";

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
let _initPromise: Promise<void> | null = null;

function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: getStorageUrl(), max: 3 });
  return _pool;
}

async function ensureTable(): Promise<void> {
  if (_initPromise) return _initPromise;
  const p = _doEnsureTable();
  _initPromise = p;
  // Reset on failure so a transient error doesn't permanently brick the app.
  p.catch(() => { if (_initPromise === p) _initPromise = null; });
  return p;
}

async function _doEnsureTable(): Promise<void> {
  // Migrate from old table name if it exists.
  await getPool().query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_postgis_frontend_connections')
         AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_pgmaps_connections')
      THEN
        ALTER TABLE _postgis_frontend_connections RENAME TO _pgmaps_connections;
      END IF;
    END $$
  `);
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS _pgmaps_connections (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      host          TEXT NOT NULL,
      database      TEXT NOT NULL,
      encrypted_dsn TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await getPool().query(`CREATE EXTENSION IF NOT EXISTS postgis`).catch(() => {});

  const envDsn = process.env.POSTGRES_URL ?? process.env.STORAGE_DB_URL;
  if (envDsn) {
    const { host, database } = parseHostDb(envDsn);

    // First run: seed a connection for the app's own storage database so it's
    // immediately browsable, without ever clobbering connections a user has added.
    // The WHERE NOT EXISTS makes this safe against concurrent workers racing here.
    await getPool().query(
      `INSERT INTO _pgmaps_connections (id, name, host, database, encrypted_dsn)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (SELECT 1 FROM _pgmaps_connections)`,
      [newId(), "Default", host, database, encryptDsn(envDsn)]
    );

    // Any saved connection pointing at the same host+database as POSTGRES_URL is the
    // same physical database — keep its encrypted_dsn in sync with the current env
    // value so rotating that database's password doesn't strand the row under an
    // unrecoverable old key.
    await getPool().query(
      `UPDATE _pgmaps_connections SET encrypted_dsn = $1 WHERE host = $2 AND database = $3`,
      [encryptDsn(envDsn), host, database]
    );
  }

  // Heal any other connections encrypted with an old key (e.g. after DSN_ENCRYPTION_KEY rotation).
  try {
    const { rows: allConns } = await getPool().query(
      `SELECT id, encrypted_dsn FROM _pgmaps_connections`
    );
    for (const conn of allConns) {
      if (!needsReencrypt(conn.encrypted_dsn)) continue;
      try {
        const plain = decryptDsn(conn.encrypted_dsn);
        await getPool().query(
          `UPDATE _pgmaps_connections SET encrypted_dsn = $1 WHERE id = $2`,
          [encryptDsn(plain), conn.id]
        );
      } catch {}
    }
  } catch {}
}

export async function listConnections(): Promise<ConnectionEntry[]> {
  await ensureTable();
  const { rows } = await getPool().query(
    `SELECT id, name, host, database, created_at FROM _pgmaps_connections ORDER BY created_at DESC`
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, host: r.host, database: r.database,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function getConnection(id: string): Promise<string> {
  await ensureTable();
  const { rows } = await getPool().query(
    `SELECT encrypted_dsn FROM _pgmaps_connections WHERE id = $1`, [id]
  );
  if (!rows[0]) throw new Error("Connection not found");
  const encDsn: string = rows[0].encrypted_dsn;
  const plaintext = decryptDsn(encDsn);
  // Auto-heal: if this was encrypted with an old key, re-encrypt with the current key now.
  if (needsReencrypt(encDsn)) {
    getPool().query(
      `UPDATE _pgmaps_connections SET encrypted_dsn = $1 WHERE id = $2`,
      [encryptDsn(plaintext), id]
    ).catch(() => {});
  }
  return plaintext;
}

export async function addConnection(name: string, rawDsn: string): Promise<ConnectionEntry> {
  await ensureTable();
  const id = newId();
  const { host, database } = parseHostDb(rawDsn);
  const { rows } = await getPool().query(
    `INSERT INTO _pgmaps_connections (id, name, host, database, encrypted_dsn)
     VALUES ($1, $2, $3, $4, $5) RETURNING created_at`,
    [id, name.trim(), host, database, encryptDsn(rawDsn)]
  );
  return { id, name: name.trim(), host, database, createdAt: rows[0].created_at.toISOString() };
}

export async function renameConnection(id: string, name: string): Promise<void> {
  await ensureTable();
  const { rowCount } = await getPool().query(
    `UPDATE _pgmaps_connections SET name = $2 WHERE id = $1`, [id, name.trim()]
  );
  if (!rowCount) throw new Error("Connection not found");
}

export async function updateConnection(id: string, name: string, rawDsn?: string): Promise<void> {
  await ensureTable();
  if (rawDsn) {
    const { host, database } = parseHostDb(rawDsn);
    const { rowCount } = await getPool().query(
      `UPDATE _pgmaps_connections SET name = $2, host = $3, database = $4, encrypted_dsn = $5 WHERE id = $1`,
      [id, name.trim(), host, database, encryptDsn(rawDsn)]
    );
    if (!rowCount) throw new Error("Connection not found");
  } else {
    await renameConnection(id, name);
  }
}

export async function deleteConnection(id: string): Promise<void> {
  await ensureTable();
  await getPool().query(`DELETE FROM _pgmaps_connections WHERE id = $1`, [id]);
}
