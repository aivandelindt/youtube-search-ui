import { subscribeSse } from "@/lib/sse-broadcast";
import { listJobs } from "@/lib/jobs-repo";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  getDb();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const jobs = listJobs(500);
      controller.enqueue(
        encoder.encode(
          `event: snapshot\ndata: ${JSON.stringify({ jobs })}\n\n`,
        ),
      );

      const unsubscribe = subscribeSse((chunk) => {
        controller.enqueue(encoder.encode(chunk));
      });

      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 30000);

      const cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
