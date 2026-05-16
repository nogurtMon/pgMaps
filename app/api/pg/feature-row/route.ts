import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";
import { invalidateTilesByPrefix } from "@/lib/tile-cache";

function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

export async function POST(req: NextRequest) {
  const { connectionId, shareId, dsn: legacyDsn, schema, table, ctid } = await req.json();

  if (!schema || !table) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  let dsn: string;
  try {
    dsn = await resolveDsnFromRequest({ connectionId, shareId, dsn: legacyDsn, schema, table });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Invalid connection" }, { status: 400 });
  }

  const pool = getPool(dsn);
  const client = await pool.connect();
  try {
    const colRes = await client.query(
      `SELECT column_name, data_type, udt_name, column_default
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table]
    );

    const nonGeomCols = colRes.rows
      .filter((r: any) => r.udt_name !== "geometry" && r.udt_name !== "geography")
      .map((r: any) => ({
        name: r.column_name as string,
        dataType: r.data_type as string,
        hasDefault: r.column_default != null,
        isSerial: typeof r.column_default === "string" && r.column_default.startsWith("nextval("),
      }));

    if (nonGeomCols.length === 0 || !ctid) {
      client.release();
      return NextResponse.json({ row: null, columns: nonGeomCols });
    }

    const { rows } = await client.query(
      `SELECT ${nonGeomCols.map(c => qi(c.name)).join(", ")}
       FROM ${qi(schema)}.${qi(table)}
       WHERE ctid = $1::tid
       LIMIT 1`,
      [ctid]
    );

    client.release();
    return NextResponse.json({ row: rows[0] ?? null, columns: rows[0] ? nonGeomCols : [] });
  } catch (e: any) {
    client.release(new Error("destroy"));
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { connectionId, shareId, schema, table, geomCol, geometry, srid, attrs } = await req.json();

  if (!schema || !table || !geomCol || !geometry) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  let dsn: string;
  try {
    dsn = await resolveDsnFromRequest({ connectionId, shareId, schema, table });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Invalid connection" }, { status: 400 });
  }

  const targetSrid = srid && Number(srid) !== 4326 ? Number(srid) : null;
  const geomExpr = targetSrid
    ? `ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326), ${targetSrid})`
    : `ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326)`;

  const attrKeys = Object.keys(attrs ?? {});
  const cols = [geomCol, ...attrKeys];
  const vals: any[] = [JSON.stringify(geometry), ...attrKeys.map((k: string) => (attrs[k] === "" ? null : attrs[k]))];
  const placeholders = [geomExpr, ...attrKeys.map((_: string, i: number) => `$${i + 2}`)];

  const pool = getPool(dsn);
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ${qi(schema)}.${qi(table)} (${cols.map(qi).join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING ctid`,
      vals
    );
    client.release();
    invalidateTilesByPrefix(`${dsn}|${schema}|${table}`);
    return NextResponse.json({ ok: true, ctid: rows[0]?.ctid ?? null });
  } catch (e: any) {
    client.release(new Error("destroy"));
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { connectionId, shareId, schema, table, ctid } = await req.json();

  if (!schema || !table || !ctid) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  let dsn: string;
  try {
    dsn = await resolveDsnFromRequest({ connectionId, shareId, schema, table });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Invalid connection" }, { status: 400 });
  }

  const pool = getPool(dsn);
  const client = await pool.connect();
  try {
    await client.query(
      `DELETE FROM ${qi(schema)}.${qi(table)} WHERE ctid = $1::tid`,
      [ctid]
    );
    client.release();
    invalidateTilesByPrefix(`${dsn}|${schema}|${table}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    client.release(new Error("destroy"));
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { connectionId, shareId, schema, table, ctid, updates } = await req.json();

  if (!schema || !table || !ctid || !updates || Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  let dsn: string;
  try {
    dsn = await resolveDsnFromRequest({ connectionId, shareId, schema, table });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Invalid connection" }, { status: 400 });
  }

  const pool = getPool(dsn);
  const client = await pool.connect();
  try {
    const keys = Object.keys(updates);
    const values = keys.map(k => updates[k]);
    const setClauses = keys.map((col, i) => `${qi(col)} = $${i + 1}`).join(", ");

    const { rows: updateRows } = await client.query(
      `UPDATE ${qi(schema)}.${qi(table)} SET ${setClauses} WHERE ctid = $${keys.length + 1}::tid RETURNING ctid`,
      [...values, ctid]
    );

    client.release();
    invalidateTilesByPrefix(`${dsn}|${schema}|${table}`);
    return NextResponse.json({ ok: true, ctid: updateRows[0]?.ctid ?? null });
  } catch (e: any) {
    client.release(new Error("destroy"));
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
