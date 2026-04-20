import { decryptDsn } from "./dsn-token";
import { getConnection } from "./connections-store";
import { getShare } from "./share-store";

/** Resolve a named connection by its server-side ID. */
export async function resolveConnectionDsn(connectionId: string): Promise<string> {
  return getConnection(connectionId);
}

/**
 * Unified resolver used by all API routes.
 * Priority: connectionId > shareId > dsn token (legacy)
 */
export async function resolveDsnFromRequest(params: {
  connectionId?: string | null;
  shareId?: string | null;
  dsn?: string | null;
}): Promise<string> {
  if (params.connectionId) return await resolveConnectionDsn(params.connectionId);
  if (params.shareId) return resolveShareDsn(params.shareId);
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
 * Resolve DSN for a public share. Looks up the share's connectionId server-side;
 * falls back to raw DSN stored in legacy share files.
 */
export async function resolveShareDsn(shareId: string | null | undefined): Promise<string> {
  if (!shareId || !/^[a-zA-Z0-9_-]{1,40}$/.test(shareId)) throw new Error("Invalid shareId");
  const config = await getShare(shareId);
  if (!config) throw new Error("Share not found");
  if (config.connectionId) return await resolveConnectionDsn(config.connectionId);
  if (config.dsn && typeof config.dsn === "string" && config.dsn.length > 0) return config.dsn;
  throw new Error("Share has no connection");
}
