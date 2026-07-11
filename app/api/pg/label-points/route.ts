import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pool";
import { resolveDsnFromRequest } from "@/lib/resolve-dsn";

const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function qi(s: string) { return `"${s.replace(/"/g, '""')}"`; }

// GET /api/pg/label-points
// Returns centroid lat/lng + requested columns for deck.gl TextLayer label rendering.
// Limited to 2000 rows (labels are useless at densities higher than this anyway).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const connectionId = sp.get("connectionId") ?? undefined;
  const shareId = sp.get("shareId") ?? undefined;
  const schema = sp.get("schema") ?? "";
  const table = sp.get("table") ?? "";
  const geomCol = sp.get("geomCol") ?? "geom";
  const srid = parseInt(sp.get("srid") ?? "4326", 10);
  const columnsParam = sp.get("columns") ?? "";
  const limit = Math.min(parseInt(sp.get("limit") ?? "2000", 10), 5000);

  if (!schema || !table || !columnsParam)
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  if (!VALID_IDENT.test(schema) || !VALID_IDENT.test(table) || !VALID_IDENT.test(geomCol))
    return NextResponse.json({ error: "Invalid identifiers" }, { status: 400 });

  const columns = columnsParam.split(",").map(c => c.trim()).filter(c => VALID_IDENT.test(c));
  if (columns.length === 0)
    return NextResponse.json({ error: "No valid columns" }, { status: 400 });

  let dsn: string;
  try { dsn = await resolveDsnFromRequest({ connectionId, shareId }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 401 }); }

  const pool = getPool(dsn);
  try {
    const geomExpr = srid === 4326 ? qi(geomCol) : `ST_Transform(${qi(geomCol)}, 4326)`;
    const sel = columns.map(c => `${qi(c)}::text AS ${qi(c)}`).join(", ");
    const sql = `
      SELECT
        ST_X(ST_Centroid(${geomExpr})) AS longitude,
        ST_Y(ST_Centroid(${geomExpr})) AS latitude,
        ${sel}
      FROM ${qi(schema)}.${qi(table)}
      WHERE ${qi(geomCol)} IS NOT NULL
      LIMIT $1
    `;
    const { rows } = await pool.query(sql, [limit]);
    return NextResponse.json(rows.filter(r => r.longitude != null && r.latitude != null));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
