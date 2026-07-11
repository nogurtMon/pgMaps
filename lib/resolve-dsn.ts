import { decryptDsn } from "./dsn-token";
import { getConnection } from "./connections-store";
import { getShare } from "./share-store";

interface CacheEntry { dsn: string; ts: number }
// 60-second TTL: stale entries from deleted/updated connections self-heal within one minute.
const DSN_TTL_MS = 60_000;
const dsnCache = new Map<string, CacheEntry>();

/** Resolve a named connection by its server-side ID. Result is cached with a 60s TTL. */
export async function resolveConnectionDsn(connectionId: string): Promise<string> {
  const cached = dsnCache.get(connectionId);
  if (cached && Date.now() - cached.ts < DSN_TTL_MS) return cached.dsn;
  try {
    const dsn = await getConnection(connectionId);
    dsnCache.set(connectionId, { dsn, ts: Date.now() });
    return dsn;
  } catch (e) {
    // If storage is temporarily unreachable, fall back to stale cache rather than erroring.
    if (cached) return cached.dsn;
    throw e;
  }
}

/** Remove a connection's DSN from the in-process cache. Call on connection update/delete. */
export function evictDsnCache(connectionId: string): void {
  dsnCache.delete(connectionId);
}

/**
 * Unified resolver used by all API routes.
 * Priority: connectionId > shareId > dsn token (legacy)
 * schema + table are forwarded to resolveShareDsn for per-layer connection lookup.
 */
export async function resolveDsnFromRequest(params: {
  connectionId?: string | null;
  shareId?: string | null;
  dsn?: string | null;
  schema?: string | null;
  table?: string | null;
}): Promise<string> {
  if (params.connectionId) return await resolveConnectionDsn(params.connectionId);
  if (params.shareId) return resolveShareDsn(params.shareId, params.schema ?? undefined, params.table ?? undefined);
  if (params.dsn) return resolveDsn(params.dsn);
  throw new Error("No connection provided");
}

/**
 * Legacy: resolve an encrypted DSN token. Kept for backward compat with
 * any saved views or clients that still send a token.
 */
export function resolveDsn(token: string | null | undefined): string {
  if (!token) throw new Error("Missing token");
  try {
    const dsn = decryptDsn(token);
    if (!dsn.startsWith("postgres")) throw new Error("Bad token payload");
    return dsn;
  } catch {
    throw new Error("Invalid token");
  }
}

/**
 * Resolve DSN for a public share. Uses connectionMap for per-layer connection
 * lookup when schema+table are provided; falls back to the share's primary connectionId.
 */
export async function resolveShareDsn(shareId: string | null | undefined, schema?: string, table?: string): Promise<string> {
  if (!shareId || !/^[a-zA-Z0-9_-]{1,40}$/.test(shareId)) throw new Error("Invalid shareId");
  const result = await getShare(shareId);
  if (result.isExpired) throw new Error("Share has expired");
  const config = result.config;
  if (!config) throw new Error("Share not found");
  if (schema && table && config.connectionMap) {
    const layerConnId = config.connectionMap[`${schema}.${table}`];
    if (layerConnId) return await resolveConnectionDsn(layerConnId);
  }
  if (config.connectionId) return await resolveConnectionDsn(config.connectionId);
  if (config.dsn && typeof config.dsn === "string" && config.dsn.length > 0) return config.dsn;
  throw new Error("Share has no connection");
}
