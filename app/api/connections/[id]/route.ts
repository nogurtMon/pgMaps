import { NextRequest, NextResponse } from "next/server";
import { getConnection, renameConnection, deleteConnection } from "@/lib/connections-store";
import { getPool } from "@/lib/pool";

// GET /api/connections/[id]/test — test the connection
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
    await deleteConnection(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
