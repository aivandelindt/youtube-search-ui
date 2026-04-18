import { NextResponse } from "next/server";

import { searchYoutube } from "@/lib/youtube-search";
import { youtubeSearchQuerySchema } from "@/lib/youtube-search-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = youtubeSearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    max: url.searchParams.get("max") ?? undefined,
    duration: url.searchParams.get("duration") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { q, max, duration } = parsed.data;

  try {
    const results = await searchYoutube(q, max, duration);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/youtube/search]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
