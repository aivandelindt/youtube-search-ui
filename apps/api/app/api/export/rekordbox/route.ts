import { NextResponse } from "next/server";

import { z } from "zod";

import { buildRekordboxCollectionXml } from "@/lib/rekordbox-xml";
import { listLibrary } from "@/lib/jobs-repo";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  trackIds: z.array(z.string().min(1)).min(1),
  playlistName: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  getDb();
  const json: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const all = listLibrary({});
  const idSet = new Set(parsed.data.trackIds);
  const tracks = all.filter((t) => idSet.has(t.id));
  if (tracks.length === 0) {
    return NextResponse.json({ error: "No matching tracks" }, { status: 400 });
  }

  const xml = buildRekordboxCollectionXml(tracks, parsed.data.playlistName);
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rekordbox-export.xml"',
    },
  });
}
