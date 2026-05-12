import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";
import { invalidateTilesByPrefix } from "@/lib/tile-cache";

const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

export async function POST(req: NextRequest) {
  const { connectionId, shareId, dsn: legacyDsn, schema, table, geomCol, ctid } = await req.json();

  if (!schema || !table || !geomCol || !ctid)
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });

  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, shareId, dsn: legacyDsn }); }
  catch (e: any) { return NextResponse.json({ error: e.message ?? "Invalid connection" }, { status: 400 }); }

  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table))
    return NextResponse.json({ error: "Invalid schema or table" }, { status: 400 });

  const pool = getPool(dsn);
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT ST_AsGeoJSON(ST_Transform(ST_Force2D(${qi(geomCol)}), 4326)) AS geometry
       FROM ${qi(schema)}.${qi(table)}
       WHERE ctid = $1::tid`,
      [ctid]
    );
    if (!rows[0]?.geometry)
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    return NextResponse.json({ geometry: JSON.parse(rows[0].geometry) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const { connectionId, shareId, dsn: legacyDsn, schema, table, geomCol, ctid, geometry, srid } = await req.json();

  if (!schema || !table || !geomCol || !ctid || !geometry)
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });

  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, shareId, dsn: legacyDsn }); }
  catch (e: any) { return NextResponse.json({ error: e.message ?? "Invalid connection" }, { status: 400 }); }

  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table))
    return NextResponse.json({ error: "Invalid schema or table" }, { status: 400 });

  const targetSrid = srid && srid !== 4326 ? Number(srid) : null;
  const geomExpr = targetSrid
    ? `ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326), ${targetSrid})`
    : `ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326)`;

  const pool = getPool(dsn);
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ${qi(schema)}.${qi(table)}
       SET ${qi(geomCol)} = ${geomExpr}
       WHERE ctid = $2::tid
       RETURNING ctid`,
      [JSON.stringify(geometry), ctid]
    );
    invalidateTilesByPrefix(`${dsn}|${schema}|${table}`);
    return NextResponse.json({ ok: true, newCtid: rows[0]?.ctid ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}
