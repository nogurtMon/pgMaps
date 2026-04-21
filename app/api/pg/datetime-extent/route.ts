import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";

const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

// POST { dsn, schema, table, column }
// Returns { min: "ISO", max: "ISO" }
export async function POST(req: NextRequest) {
  const { connectionId, dsn: legacyDsn, schema, table, column } = await req.json();
  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, dsn: legacyDsn }); }
  catch (e: any) { return NextResponse.json({ error: e.message ?? "Invalid token" }, { status: 400 }); }
  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table) || !VALID_IDENT.test(column))
    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });

  const pool = getPool(dsn);
  try {
    const { rows } = await pool.query(
      `SELECT
         MIN(${qi(column)})::timestamptz AS min,
         MAX(${qi(column)})::timestamptz AS max
       FROM ${qi(schema)}.${qi(table)}
       WHERE ${qi(column)} IS NOT NULL`,
    );
    const row = rows[0];
    if (!row || row.min == null) {
      return NextResponse.json({ error: "No datetime values found" }, { status: 404 });
    }
    return NextResponse.json({
      min: new Date(row.min).toISOString().slice(0, 10),
      max: new Date(row.max).toISOString().slice(0, 10),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
