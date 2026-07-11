import { NextRequest, NextResponse } from "next/server";
import { getShare, setShare, deleteShare, hashPassword } from "@/lib/share-store";

function safeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,40}$/.test(id);
}

// GET /api/share/[id] — load a shared view (returns 401 if password protected, 410 if expired)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!safeId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const result = await getShare(id);
    if (result.isExpired) return NextResponse.json({ error: "This share link has expired.", is_expired: true }, { status: 410 });
    if (result.requiresPassword) return NextResponse.json({ requires_password: true }, { status: 401 });
    if (!result.config) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const { dsn: _dsn, connectionMap: _map, ...safeConfig } = result.config;
    return NextResponse.json(safeConfig);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/share/[id] — verify password and return share config
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!safeId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { password } = await req.json();
    const result = await getShare(id, password);
    if (result.isExpired) return NextResponse.json({ error: "This share link has expired.", is_expired: true }, { status: 410 });
    if (result.requiresPassword) return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
    if (!result.config) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const { dsn: _dsn, connectionMap: _map, ...safeConfig } = result.config;
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
    if (!safeId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { layers, basemap, name, view, homeView, password, expiresAt, markdown } = await req.json();
    if (!Array.isArray(layers) || layers.length === 0)
      return NextResponse.json({ error: "No layers provided" }, { status: 400 });

    const connectionId = layers[0].connectionId;
    if (!connectionId) return NextResponse.json({ error: "Layer has no connection" }, { status: 400 });

    const connectionMap: Record<string, string> = {};
    for (const l of layers) {
      if (l.connectionId && l.table?.table_schema && l.table?.table_name)
        connectionMap[`${l.table.table_schema}.${l.table.table_name}`] = l.connectionId;
    }
    const safeLayers = layers.map(({ connectionId: _cid, ...rest }: any) => rest);

    const existingResult = await getShare(id);
    const existing = existingResult.config;
    const isNew = !existing;
    const now = new Date().toISOString();
    const displayName = ((name ?? existing?.name ?? "").trim()) || "Untitled View";

    const config = {
      ...(existing ?? {}),
      connectionId,
      connectionMap,
      layers: safeLayers,
      basemap: basemap ?? "liberty",
      name: displayName,
      view: view ?? existing?.view,
      homeView: homeView ?? existing?.homeView,
      markdown: markdown !== undefined ? (markdown || undefined) : existing?.markdown,
      ...(isNew ? { createdAt: now } : {}),
      updatedAt: now,
    };

    const passwordHash = password !== undefined ? (password ? hashPassword(id, password) : null) : undefined;
    await setShare(id, displayName, config, isNew, now, passwordHash, expiresAt ?? null);
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/share/[id] — unpublish
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!safeId(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    await deleteShare(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
