import { NextRequest, NextResponse } from "next/server";
import { listConnections, addConnection } from "@/lib/connections-store";
import { getPool } from "@/lib/pool";

// GET /api/connections — list saved connections (no DSNs)
export async function GET() {
  try {
    return NextResponse.json(await listConnections());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/connections — { name, dsn } — saves and optionally tests
export async function POST(req: NextRequest) {
  try {
    const { name, dsn, test: doTest } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!dsn?.startsWith("postgres")) return NextResponse.json({ error: "Invalid connection string" }, { status: 400 });

    if (doTest) {
      const pool = getPool(dsn);
      const client = await pool.connect();
      try { await client.query("SELECT 1"); } finally { client.release(); }
    }

    const entry = await addConnection(name, dsn);
    return NextResponse.json(entry);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
