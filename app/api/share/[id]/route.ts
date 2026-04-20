import { NextRequest, NextResponse } from "next/server";
import { getShare, setShare, deleteShare } from "@/lib/share-store";
import { getConnection } from "@/lib/connections-store";

function safeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,40}$/.test(id);
}

// GET /api/share/[id] — load a saved view (never sends DSN to client)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!safeId(id))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const config = await getShare(id);
    if (!config)
      return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const { dsn: _dsn, ...safeConfig } = config;
    return NextResponse.json(safeConfig);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/share/[id] — upsert a saved view
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!safeId(id))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { layers, basemap, name, view } = await req.json();
    if (!Array.isArray(layers) || layers.length === 0)
      return NextResponse.json({ error: "No layers provided" }, { status: 400 });

    const connectionId = layers[0].connectionId;
    if (!connectionId) return NextResponse.json({ error: "Layer has no connection" }, { status: 400 });
    try { getConnection(connectionId); } catch {
      return NextResponse.json({ error: "Connection not found" }, { status: 400 });
    }
    const safeLayers = layers.map(({ connectionId: _cid, ...rest }: any) => rest);

    const existing = await getShare(id);
    const isNew = !existing;
    const now = new Date().toISOString();
    const displayName = ((name ?? existing?.name ?? "").trim()) || "Untitled View";

    const config = {
      ...(existing ?? {}),
      connectionId,
      layers: safeLayers,
      basemap: basemap ?? "liberty",
      name: displayName,
      view: view ?? existing?.view,
      ...(isNew ? { createdAt: now } : {}),
      updatedAt: now,
    };

    await setShare(id, displayName, config, isNew, now);
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/share/[id] — remove a saved view
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!safeId(id))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await deleteShare(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
