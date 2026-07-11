import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";

function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

// Returns { value: string, count: number }[] sorted by value ascending.
// Capped at 500 distinct values — beyond that the histogram isn't useful.
export async function POST(req: NextRequest) {
  try {
    const { connectionId, dsn: legacyDsn, schema, table, column } = await req.json();
    const dsn = await resolveDsnFromRequest({ connectionId, dsn: legacyDsn });
    if (!schema || !table || !column)
      return NextResponse.json({ error: "Missing schema, table, or column" }, { status: 400 });

    const pool = getPool(dsn);
    const { rows } = await pool.query(
      `SELECT ${qi(column)}::text AS value, COUNT(*)::int AS count
       FROM ${qi(schema)}.${qi(table)}
       WHERE ${qi(column)} IS NOT NULL
       GROUP BY ${qi(column)}
       ORDER BY ${qi(column)} ASC
       LIMIT 500`,
    );
    return NextResponse.json({ counts: rows as { value: string; count: number }[] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
