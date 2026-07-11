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

// GET /api/pg/saved-views/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { rows } = await getPool().query(
      `SELECT id, connection_id, name, state_json, is_public, archived, folder_id, is_template, created_at, updated_at
       FROM _pgmaps_maps WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ view: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/pg/saved-views/[id]  { name?, state?, is_public?, archived? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, state, is_public, archived, folder_id, sort_order, is_template } = await req.json();
  try {
    const setClauses: string[] = ["updated_at = NOW()"];
    const queryParams: any[] = [];
    if (name?.trim()) { queryParams.push(name.trim()); setClauses.push(`name = $${queryParams.length}`); }
    if (state !== undefined) { queryParams.push(JSON.stringify(state)); setClauses.push(`state_json = $${queryParams.length}`); }
    if (is_public !== undefined) { queryParams.push(is_public); setClauses.push(`is_public = $${queryParams.length}`); }
    if (archived !== undefined) { queryParams.push(archived); setClauses.push(`archived = $${queryParams.length}`); }
    if (folder_id !== undefined) { queryParams.push(folder_id ?? null); setClauses.push(`folder_id = $${queryParams.length}`); }
    if (sort_order !== undefined) { queryParams.push(sort_order); setClauses.push(`sort_order = $${queryParams.length}`); }
    if (is_template !== undefined) { queryParams.push(is_template); setClauses.push(`is_template = $${queryParams.length}`); }
    queryParams.push(id);
    await getPool().query(
      `UPDATE _pgmaps_maps SET ${setClauses.join(", ")} WHERE id = $${queryParams.length}`,
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
    await getPool().query(`DELETE FROM _pgmaps_maps WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
