import { NextRequest, NextResponse } from "next/server";
import { getConnection, updateConnection, deleteConnection } from "@/lib/connections-store";
import { getPool } from "@/lib/pool";
import { evictDsnCache } from "@/lib/resolve-dsn";

// GET /api/connections/[id] — test connection, or return DSN with ?dsn=1
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dsn = await getConnection(id);
    if (req.nextUrl.searchParams.get("dsn") === "1") {
      return NextResponse.json({ dsn });
    }
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

// PUT /api/connections/[id] — update name and/or DSN
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, dsn } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    await updateConnection(id, name, dsn?.trim() || undefined);
    if (dsn?.trim()) evictDsnCache(id);
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
    evictDsnCache(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
