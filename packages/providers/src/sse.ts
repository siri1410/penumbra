export interface SseEvent {
  event?: string;
  data: string;
}

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const evt = parseEvent(raw);
        if (evt) yield evt;
      }
    }
    if (buffer.trim().length > 0) {
      const evt = parseEvent(buffer);
      if (evt) yield evt;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(raw: string): SseEvent | null {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}
