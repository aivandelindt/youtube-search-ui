import { NextResponse } from "next/server";

import { createDownloadsBodySchema } from "@/lib/download-settings-schema";
import { listJobs } from "@/lib/jobs-repo";
import { enqueueNewJob } from "@/lib/download-jobs";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  getDb();
  return NextResponse.json({ jobs: listJobs(500) });
}

export async function POST(request: Request) {
  getDb();
  const json: unknown = await request.json().catch(() => null);
  const parsed = createDownloadsBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const jobIds: string[] = [];
  const deduped: string[] = [];

  for (const item of parsed.data.items) {
    const { jobId, deduped: isDup } = await enqueueNewJob({
      videoId: item.videoId,
      title: item.title,
      channel: item.channel ?? "",
      url: item.url,
      settings: parsed.data.settings,
    });
    jobIds.push(jobId);
    if (isDup) deduped.push(jobId);
  }

  return NextResponse.json({ jobIds, deduped }, { status: 202 });
}
