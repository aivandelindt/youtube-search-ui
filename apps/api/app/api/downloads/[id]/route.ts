import { NextResponse } from "next/server";

import { getJob } from "@/lib/jobs-repo";
import { getJobRunner } from "@/lib/job-runner";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  getDb();
  const { id } = await context.params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}

export async function DELETE(_request: Request, context: Ctx) {
  getDb();
  const { id } = await context.params;
  const runner = getJobRunner();
  const ok = runner.cancel(id);
  if (!ok) {
    return NextResponse.json({ error: "Cannot cancel job" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
