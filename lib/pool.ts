import { Pool } from "pg";

const pools = new Map<string, Pool>();

export function getPool(dsn: string): Pool {
  if (!pools.has(dsn)) {
    pools.set(dsn, new Pool({
      connectionString: dsn,
      max: 20,
      idleTimeoutMillis: 20_000,       // close idle connections before firewalls drop them
      connectionTimeoutMillis: 10_000,  // fail fast instead of hanging
      keepAlive: true,                  // TCP keepalives prevent silent connection drops
    }));
  }
  return pools.get(dsn)!;
}
