import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

function getStorageUrl(): string {
  const url = process.env.POSTGRES_URL ?? process.env.STORAGE_DB_URL;
  if (!url) throw new Error("No storage database configured.");
  return url;
}

let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: getStorageUrl(), max: 3 });
  return _pool;
}

// POST /api/pg/reorder  { type: "folders" | "maps", ids: string[] }
// Sets sort_order = array index + 1 for each id in order.
export async function POST(req: NextRequest) {
  const { type, ids } = (await req.json()) as { type: string; ids: string[] };
  if (!type || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "type and ids required" }, { status: 400 });
  }
  const table =
    type === "folders"
      ? "_pgmaps_folders"
      : type === "maps"
      ? "_pgmaps_maps"
      : null;
  if (!table) return NextResponse.json({ error: "invalid type" }, { status: 400 });
  try {
    // Build: UPDATE t SET sort_order = v.pos FROM (VALUES ($1::text,1),($2::text,2),...) AS v(id,pos) WHERE t.id = v.id
    const valuesList = ids.map((_, i) => `($${i + 1}::text, ${i + 1})`).join(", ");
    await getPool().query(
      `UPDATE ${table} t SET sort_order = v.pos
       FROM (VALUES ${valuesList}) AS v(id, pos)
       WHERE t.id = v.id`,
      ids
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
