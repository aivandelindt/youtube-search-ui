import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getTrackById } from "@/lib/jobs-repo";
import { getDataDir } from "@/lib/paths";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
};

export async function GET(_request: Request, context: Ctx) {
  getDb();
  const { id } = await context.params;
  const track = getTrackById(id);
  if (!track) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const resolved = path.resolve(track.filePath);
  const libraryRoot = path.join(getDataDir(), "library");
  if (!resolved.startsWith(libraryRoot)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const stream = Readable.toWeb(fs.createReadStream(resolved));
  const type = MIME[track.format] ?? "application/octet-stream";

  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${encodeURIComponent(track.title)}.${track.format}"`,
    },
  });
}
