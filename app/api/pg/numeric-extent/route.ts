import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";

function qi(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

export async function POST(req: NextRequest) {
  let dsn: string;
  try {
    const body = await req.json();
    dsn = await resolveDsnFromRequest({ connectionId: body.connectionId, shareId: body.shareId, dsn: body.dsn });
    const { schema, table, column } = body;
    if (!schema || !table || !column)
      return NextResponse.json({ error: "Missing schema, table, or column" }, { status: 400 });
    const pool = getPool(dsn);
    const { rows } = await pool.query(
      `SELECT MIN(${qi(column)}) AS min, MAX(${qi(column)}) AS max FROM ${qi(schema)}.${qi(table)}`,
    );
    const { min, max } = rows[0];
    return NextResponse.json({ min: Number(min), max: Number(max) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
