import { NextResponse } from "next/server";

import { listLibrary } from "@/lib/jobs-repo";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  getDb();
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const key = url.searchParams.get("key") ?? undefined;
  const bpmMinRaw = url.searchParams.get("bpmMin");
  const bpmMaxRaw = url.searchParams.get("bpmMax");
  const bpmMin =
    bpmMinRaw != null && bpmMinRaw !== ""
      ? Number.parseFloat(bpmMinRaw)
      : undefined;
  const bpmMax =
    bpmMaxRaw != null && bpmMaxRaw !== ""
      ? Number.parseFloat(bpmMaxRaw)
      : undefined;

  const tracks = listLibrary({
    q,
    key,
    bpmMin: Number.isFinite(bpmMin) ? bpmMin : undefined,
    bpmMax: Number.isFinite(bpmMax) ? bpmMax : undefined,
  });

  return NextResponse.json({ tracks });
}
