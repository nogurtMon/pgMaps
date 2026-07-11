import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";

const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

export async function POST(req: NextRequest) {
  const { connectionId, dsn: legacyDsn, schema, table, comment } = await req.json();
  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, dsn: legacyDsn }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }

  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table))
    return NextResponse.json({ error: "Invalid schema or table" }, { status: 400 });

  const pool = getPool(dsn);
  try {
    // COMMENT ON is DDL and doesn't support $1 placeholders — interpolate safely.
    // Schema/table are already validated above; comment is escaped by doubling quotes.
    const literal = comment
      ? `'${String(comment).replace(/'/g, "''")}'`
      : "NULL";
    await pool.query(`COMMENT ON TABLE ${qi(schema)}.${qi(table)} IS ${literal}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
