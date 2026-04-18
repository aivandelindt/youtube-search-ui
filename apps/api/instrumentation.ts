export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { startJobEventsSubscriber } = await import(
    "@/lib/job-events-subscriber"
  );
  startJobEventsSubscriber();
}
