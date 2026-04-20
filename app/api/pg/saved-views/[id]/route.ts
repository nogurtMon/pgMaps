import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

function getStorageUrl(): string {
  const url = process.env.POSTGRES_URL ?? process.env.STORAGE_DB_URL;
  if (!url) throw new Error("No storage database configured. Set POSTGRES_URL in your environment.");
  return url;
}

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: getStorageUrl(), max: 3 });
  return _pool;
}

// PUT /api/pg/saved-views/[id]  { name?, state?, is_public? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, state, is_public } = await req.json();
  try {
    const setClauses: string[] = ["updated_at = NOW()"];
    const queryParams: any[] = [];
    if (name?.trim()) { queryParams.push(name.trim()); setClauses.push(`name = $${queryParams.length}`); }
    if (state !== undefined) { queryParams.push(JSON.stringify(state)); setClauses.push(`state_json = $${queryParams.length}`); }
    if (is_public !== undefined) { queryParams.push(is_public); setClauses.push(`is_public = $${queryParams.length}`); }
    queryParams.push(id);
    await getPool().query(
      `UPDATE _postgis_frontend_saved_views SET ${setClauses.join(", ")} WHERE id = $${queryParams.length}`,
      queryParams
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/pg/saved-views/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await getPool().query(`DELETE FROM _postgis_frontend_saved_views WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
