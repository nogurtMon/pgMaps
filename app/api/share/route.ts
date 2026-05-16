import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getShare, setShare, listShares, hashPassword, type ViewIndexEntry } from "@/lib/share-store";
import { getConnection } from "@/lib/connections-store";

export type { ViewIndexEntry };

export async function GET() {
  try {
    return NextResponse.json(await listShares());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { layers, basemap, name, view, password, expiresAt, markdown } = await req.json();
    if (!Array.isArray(layers) || layers.length === 0)
      return NextResponse.json({ error: "No layers to share" }, { status: 400 });

    const connectionId = layers[0].connectionId;
    if (!connectionId) return NextResponse.json({ error: "Layer has no connection" }, { status: 400 });
    try { getConnection(connectionId); } catch {
      return NextResponse.json({ error: "Connection not found" }, { status: 400 });
    }

    const connectionMap: Record<string, string> = {};
    for (const l of layers) {
      if (l.connectionId && l.table?.table_schema && l.table?.table_name)
        connectionMap[`${l.table.table_schema}.${l.table.table_name}`] = l.connectionId;
    }
    const safeLayers = layers.map(({ connectionId: _cid, ...rest }: any) => rest);
    const id = randomBytes(8).toString("base64url");
    const now = new Date().toISOString();
    const displayName = (name ?? "Untitled View").trim() || "Untitled View";
    const config = {
      connectionId,
      connectionMap,
      layers: safeLayers,
      basemap: basemap ?? "liberty",
      name: displayName,
      view: view ?? undefined,
      markdown: markdown || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const passwordHash = password ? hashPassword(id, password) : null;
    await setShare(id, displayName, config, true, now, passwordHash, expiresAt ?? null);
    return NextResponse.json({ id });
  } catch (e: any) {
    console.error("[share POST]", e.message);
    return NextResponse.json({ error: e.message ?? "Failed to create view" }, { status: 500 });
  }
}
