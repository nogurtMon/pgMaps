import { NextRequest, NextResponse } from "next/server";
import { getConnection, renameConnection, deleteConnection, LOCAL_CONNECTION_ID } from "@/lib/connections-store";
import { getPool } from "@/lib/pool";
import { evictDsnCache } from "@/lib/resolve-dsn";

// GET /api/connections/[id] — test the connection
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dsn = await getConnection(id);
    const pool = getPool(dsn);
    const client = await pool.connect();
    try {
      await client.query("SELECT current_database(), version()");
      client.release();
    } catch (e) { client.release(new Error("destroy")); throw e; }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === "Connection not found" ? 404 : 500 });
  }
}

// PUT /api/connections/[id] — rename
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    await renameConnection(id, name);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/connections/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (id === LOCAL_CONNECTION_ID)
      return NextResponse.json({ error: "The local database connection cannot be deleted." }, { status: 403 });
    await deleteConnection(id);
    evictDsnCache(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
