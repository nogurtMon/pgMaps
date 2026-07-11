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

// PUT /api/pg/folders/[id]  { name }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, sort_order } = await req.json();
  if (!name?.trim() && sort_order === undefined) return NextResponse.json({ error: "name or sort_order required" }, { status: 400 });
  try {
    const setClauses: string[] = ["updated_at = NOW()"];
    const queryParams: any[] = [];
    if (name?.trim()) { queryParams.push(name.trim()); setClauses.push(`name = $${queryParams.length}`); }
    if (sort_order !== undefined) { queryParams.push(sort_order); setClauses.push(`sort_order = $${queryParams.length}`); }
    queryParams.push(id);
    await getPool().query(
      `UPDATE _pgmaps_folders SET ${setClauses.join(", ")} WHERE id = $${queryParams.length}`,
      queryParams
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/pg/folders/[id] — maps inside become unfiled via ON DELETE SET NULL
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await getPool().query(`DELETE FROM _pgmaps_folders WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
