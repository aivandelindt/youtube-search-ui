import { NextResponse } from "next/server";

import { deleteTrack, getTrackById } from "@/lib/jobs-repo";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  getDb();
  const { id } = await context.params;
  const track = getTrackById(id);
  if (!track) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(track);
}

export async function DELETE(_request: Request, context: Ctx) {
  getDb();
  const { id } = await context.params;
  const ok = deleteTrack(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
