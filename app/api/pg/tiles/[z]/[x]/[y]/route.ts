import { NextRequest, NextResponse } from "next/server";
import type { Pool } from "pg";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest, evictDsnCache } from "@/lib/resolve-dsn";
import { getCachedTile, setCachedTile } from "@/lib/tile-cache";


// Safe SQL identifier quoting
function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

// Column name cache: "dsn|schema.table|geomCol" -> column names (excluding geom)
const colCache = new Map<string, string[]>();

async function getNonGeomCols(pool: Pool, schema: string, table: string, geomCol: string, cacheKey: string) {
  if (colCache.has(cacheKey)) return colCache.get(cacheKey)!;
  const client = await pool.connect();
  let rows: any[];
  try {
    ({ rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table]
    ));
    client.release();
  } catch (e) {
    client.release(new Error("destroy"));
    throw e;
  }
  const cols = rows.map((r: any) => r.column_name as string).filter((c) => c !== geomCol);
  if (cols.length > 0) colCache.set(cacheKey, cols);
  return cols;
}

// Valid column name: alphanumeric, underscore, hyphen only
function isValidColName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_\-]*$/.test(name);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z: zs, x: xs, y: ys } = await params;
  const { searchParams } = req.nextUrl;

  const schema = searchParams.get("schema");
  const table = searchParams.get("table");
  const geomCol = searchParams.get("geomCol") ?? "geom";
  const srid = parseInt(searchParams.get("srid") ?? "4326", 10);
  let dsn: string;
  try {
    dsn = await resolveDsnFromRequest({
      connectionId: searchParams.get("connectionId"),
      shareId: searchParams.get("shareId"),
      dsn: searchParams.get("dsn"),
      schema,
      table,
    });
  } catch (e: any) {
    console.error("[tiles] DSN resolution failed:", e.message, { schema, table });
    return NextResponse.json({ error: e.message ?? "Invalid connection" }, { status: 400 });
  }
  if (!schema || !table)
    return NextResponse.json({ error: "Missing schema or table" }, { status: 400 });

  let dsnHost = "?";
  try { dsnHost = new URL(dsn).host; } catch {}

  const z = parseInt(zs, 10);
  const x = parseInt(xs, 10);
  const y = parseInt(ys, 10);

  // Parse filters JSON
  type TileFilter = { column: string; operator: string; value: string };
  let filters: TileFilter[] = [];
  const filtersParam = searchParams.get("filters");
  if (filtersParam) {
    try { filters = JSON.parse(filtersParam); } catch {}
  }

  // Style columns must be included at every zoom level for client-side color rendering
  const scParam = searchParams.get("sc") ?? "";
  const styleColumns = scParam ? scParam.split(",").filter(Boolean) : [];

  const tileKey = `${dsn}|${schema}|${table}|${geomCol}|${z}|${x}|${y}|${filtersParam ?? ""}|${searchParams.get("v") ?? ""}|${scParam}`;
  const cached = getCachedTile(tileKey);
  if (cached.hit) {
    if (!cached.data) return new NextResponse(null, { status: 204 });
    return new NextResponse(new Uint8Array(cached.data), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.mapbox-vector-tile",
        "Cache-Control": "no-store",
      },
    });
  }

  const pool = getPool(dsn);

  try {
    const cacheKey = `${dsn}|${schema}.${table}|${geomCol}`;
    let propCols = await getNonGeomCols(pool, schema, table, geomCol, cacheKey);

    // Build parameterized WHERE clauses for filters
    const queryParams: any[] = [table, z, x, y];
    const filterClauses: string[] = [];

    const propColSet = new Set(propCols);
    const SAFE_OPS = new Set(["=", "!=", ">", "<", ">=", "<="]);
    for (const f of filters) {
      if (!isValidColName(f.column)) continue;
      if (!propColSet.has(f.column)) continue; // column doesn't exist in this table — skip
      const col = qi(f.column);
      switch (f.operator) {
        case "ilike":
          if (!f.value?.trim()) break;
          queryParams.push(`%${f.value.trim()}%`);
          filterClauses.push(`${col}::text ILIKE $${queryParams.length}`);
          break;
        case "starts_with":
          if (!f.value?.trim()) break;
          queryParams.push(`${f.value.trim()}%`);
          filterClauses.push(`${col}::text ILIKE $${queryParams.length}`);
          break;
        case "eq":
          if (!f.value && f.value !== "0") break;
          queryParams.push(f.value);
          filterClauses.push(`${col}::text = $${queryParams.length}`);
          break;
        case "neq":
          if (!f.value && f.value !== "0") break;
          queryParams.push(f.value);
          filterClauses.push(`${col}::text != $${queryParams.length}`);
          break;
        case "gt": case "lt": case "gte": case "lte": {
          if (!f.value && f.value !== "0") break;
          const sqlOp = { gt: ">", lt: "<", gte: ">=", lte: "<=" }[f.operator];
          if (!SAFE_OPS.has(sqlOp!)) break;
          queryParams.push(f.value);
          filterClauses.push(`${col} ${sqlOp} $${queryParams.length}`);
          break;
        }
        case "is_null":
          filterClauses.push(`${col} IS NULL`);
          break;
        case "is_not_null":
          filterClauses.push(`${col} IS NOT NULL`);
          break;
        case "in": {
          if (!f.value?.trim()) break;
          const vals = f.value.split(",").map((v) => v.trim()).filter(Boolean);
          if (vals.length === 0) break;
          const placeholders = vals.map((v) => { queryParams.push(v); return `$${queryParams.length}`; }).join(", ");
          filterClauses.push(`${col}::text IN (${placeholders})`);
          break;
        }
        case "not_in": {
          if (!f.value?.trim()) break;
          const vals = f.value.split(",").map((v) => v.trim()).filter(Boolean);
          if (vals.length === 0) break;
          const placeholders = vals.map((v) => { queryParams.push(v); return `$${queryParams.length}`; }).join(", ");
          filterClauses.push(`${col}::text NOT IN (${placeholders})`);
          break;
        }
        case "date_between": {
          if (!f.value?.trim()) break;
          const [from, to] = f.value.split(",").map((v) => v.trim());
          if (!from || !to) break;
          queryParams.push(from); const fromIdx = queryParams.length;
          queryParams.push(to);   const toIdx   = queryParams.length;
          filterClauses.push(`(${col} AT TIME ZONE 'UTC')::date >= $${fromIdx}::date AND (${col} AT TIME ZONE 'UTC')::date <= $${toIdx}::date`);
          break;
        }
      }
    }

    const whereFilter = filterClauses.length > 0
      ? `AND ${filterClauses.join(" AND ")}`
      : "";

    // Transform the tile envelope to the geometry's native SRID for the WHERE filter.
    // This allows PostgreSQL to use the GIST spatial index on the geometry column.
    const envelopeExpr = srid === 3857
      ? `ST_TileEnvelope($2, $3, $4)`
      : `ST_Transform(ST_TileEnvelope($2, $3, $4), ${srid})`;

    const schemaQ = qi(schema!);
    const tableQ  = qi(table!);
    const geomQ   = qi(geomCol);
    const tolerance = z <= 4 ? 10000 : z <= 6 ? 2000 : 0;
    const geomExpr = tolerance > 0
      ? `ST_SimplifyPreserveTopology(ST_Transform(${geomQ}, 3857), ${tolerance})`
      : `ST_Transform(${geomQ}, 3857)`;
    function buildSql(cols: string[]) {
      const propColSet = new Set(cols);
      // Always include style columns (categorical/threshold/numeric) so colors render at all zooms
      const required = styleColumns.filter(c => propColSet.has(c) && isValidColName(c));
      const rest = z < 12 ? [] : cols;
      const displayCols = [...new Set([...required, ...rest])];
      const sel = displayCols.length > 0 ? `, ${displayCols.map(qi).join(", ")}` : "";
      return `
        SELECT ST_AsMVT(tile, $1, 4096, 'geom') AS mvt
        FROM (
          SELECT
            ST_AsMVTGeom(
              ${geomExpr},
              ST_TileEnvelope($2, $3, $4),
              4096, 64, true
            ) AS geom,
            ctid::text AS _ctid
            ${sel}
          FROM ${schemaQ}.${tableQ}
          WHERE ${geomQ} && ${envelopeExpr}
            ${whereFilter}
        ) AS tile
        WHERE tile.geom IS NOT NULL
      `;
    }

    // Tile query timeout: low zooms scan huge areas and can hang for 10s+.
    // Cap at 8s — return empty tile rather than crashing the pool.
    const TILE_TIMEOUT_MS = 8_000;

    async function runQuery(sql: string, params: any[]): Promise<any[]> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL statement_timeout = ${TILE_TIMEOUT_MS}`);
        const { rows } = await client.query(sql, params);
        await client.query("COMMIT");
        client.release();
        return rows;
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        client.release(new Error("destroy"));
        throw e;
      }
    }

    const connectionId = searchParams.get("connectionId");

    let rows: any[];
    try {
      rows = await runQuery(buildSql(propCols), queryParams);
    } catch (qe: any) {
      const shouldRetry =
        /column .* does not exist/i.test(qe.message ?? "") ||
        qe.code === "42P01"; // relation not found — bad connection may be routed to wrong DB
      if (shouldRetry) {
        colCache.delete(cacheKey);
        propCols = await getNonGeomCols(pool, schema, table, geomCol, cacheKey);
        try {
          rows = await runQuery(buildSql(propCols), queryParams);
        } catch (retryErr: any) {
          // Retry also failed — evict DSN cache so next request re-resolves fresh
          if (retryErr.code === "42P01" && connectionId) evictDsnCache(connectionId);
          throw retryErr;
        }
      } else {
        throw qe;
      }
    }
    const mvt: Buffer | null = rows[0]?.mvt ?? null;
    if (!mvt || mvt.length === 0) {
      setCachedTile(tileKey, null);
      return new NextResponse(null, { status: 204 });
    }
    const mvtBuf = Buffer.from(mvt);
    setCachedTile(tileKey, mvtBuf);
    return new NextResponse(mvtBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.mapbox-vector-tile",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    const msg: string = e.message ?? "";
    const code: string = e.code ?? "";
    // Any PostgreSQL error (has a code) → return empty tile rather than 500.
    // The map keeps working; the error is logged server-side for debugging.
    // Non-pg errors (missing params, bad DSN) are caught earlier and already return 4xx.
    if (code) {
      console.error("[tiles pg-err]", { db: dsnHost, schema, table, z, x, y, code, error: msg });
      return new NextResponse(null, { status: 204 });
    }
    console.error("[tiles 500]", { db: dsnHost, schema, table, z, x, y, geomCol, srid, error: msg, detail: e.detail });
    return NextResponse.json({ error: msg || "unknown error" }, { status: 500 });
  }
}
