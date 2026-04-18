import { NextResponse } from "next/server";

import { analyzeAudioFile } from "@/lib/analyze-track";
import {
  getTrackById,
  listJobs,
  replaceAnalysisForTrack,
} from "@/lib/jobs-repo";
import { broadcastSse } from "@/lib/sse-broadcast";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  getDb();
  const { id } = await context.params;
  const track = getTrackById(id);
  if (!track) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const analysis = await analyzeAudioFile(track.filePath);
  replaceAnalysisForTrack(id, analysis);
  const updated = getTrackById(id);
  broadcastSse("library", { tracks: "refresh" });
  broadcastSse("jobs", { jobs: listJobs(500) });
  return NextResponse.json({ ok: true, track: updated });
}
