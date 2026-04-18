import { NextResponse } from "next/server";

import { getJobRunner } from "@/lib/job-runner";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  getDb();
  const { id } = await context.params;
  const ok = getJobRunner().retry(id);
  if (!ok) {
    return NextResponse.json({ error: "Retry not allowed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
