import { NextResponse } from "next/server";
import { restoreDefaults } from "@/lib/basemaps-store";

export async function POST() {
  try {
    await restoreDefaults();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
