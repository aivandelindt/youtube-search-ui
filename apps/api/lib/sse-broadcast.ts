type SseListener = (sseChunk: string) => void;

const listeners = new Set<SseListener>();

export function subscribeSse(listener: SseListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function broadcastSse(event: string, payload: unknown): void {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const listener of listeners) {
    try {
      listener(data);
    } catch {
      listeners.delete(listener);
    }
  }
}

export function getSseSubscriberCount(): number {
  return listeners.size;
}
