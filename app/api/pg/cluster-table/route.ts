import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";

function ident(...parts: string[]) {
  return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
}

const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export async function POST(req: NextRequest) {
  const { connectionId, dsn: legacyDsn, schema, table, geomCol } = await req.json();
  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, dsn: legacyDsn }); }
  catch (e: any) { return NextResponse.json({ error: e.message ?? "Invalid token" }, { status: 400 }); }
  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table))
    return NextResponse.json({ error: "Invalid schema or table" }, { status: 400 });

  const col = geomCol ?? "geom";
  if (!VALID_IDENT.test(col))
    return NextResponse.json({ error: "Invalid geometry column" }, { status: 400 });

  const pool = getPool(dsn);
  const client = await pool.connect();
  try {
    // Find the GIST index name on the geometry column
    const { rows } = await client.query(
      `SELECT ic.relname AS index_name
       FROM pg_index idx
       JOIN pg_class ic ON ic.oid = idx.indexrelid
       JOIN pg_class tc ON tc.oid = idx.indrelid
       JOIN pg_namespace n ON n.oid = tc.relnamespace
       JOIN pg_am am ON am.oid = ic.relam
       JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = ANY(idx.indkey::smallint[])
       WHERE n.nspname = $1
         AND tc.relname = $2
         AND a.attname = $3
         AND am.amname = 'gist'
       LIMIT 1`,
      [schema, table, col]
    );
    if (rows.length === 0)
      return NextResponse.json({ error: "No GIST index found on geometry column" }, { status: 400 });

    const indexName = rows[0].index_name as string;
    await client.query(
      `CLUSTER ${ident(schema, table)} USING ${ident(indexName)}`
    );
    await client.query(`ANALYZE ${ident(schema, table)}`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}
