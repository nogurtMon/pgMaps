import { NextRequest, NextResponse } from "next/server";
import { listBasemaps, addBasemap } from "@/lib/basemaps-store";

export async function GET() {
  try {
    const basemaps = await listBasemaps();
    return NextResponse.json(basemaps);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, styleUrl } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!styleUrl?.trim()) return NextResponse.json({ error: "Style URL is required" }, { status: 400 });
    const entry = await addBasemap(name, styleUrl);
    return NextResponse.json(entry);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
