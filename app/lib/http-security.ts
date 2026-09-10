export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsedOrigin = new URL(origin);
    const requestUrl = new URL(request.url);
    if (origin !== parsedOrigin.origin) return false;
    if (parsedOrigin.origin === requestUrl.origin) return true;
    return parsedOrigin.protocol === requestUrl.protocol
      && normalizedPort(parsedOrigin) === normalizedPort(requestUrl)
      && isLoopbackHost(parsedOrigin.hostname)
      && isLoopbackHost(requestUrl.hostname);
  } catch {
    return false;
  }
}

function normalizedPort(url: URL): string {
  if (url.port) return url.port;
  return url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "";
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLocaleLowerCase("en-US").replace(/^\[|\]$/gu, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function declaredBodyLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (!raw || !/^\d+$/u.test(raw)) return null;
  const length = Number(raw);
  return Number.isSafeInteger(length) && length >= 0 ? length : null;
}

export async function readLimitedText(request: Request, maxBytes: number): Promise<string | null> {
  const declared = declaredBodyLength(request);
  if (declared != null && declared > maxBytes) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("request body limit exceeded");
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function safeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length <= 300 ? error.message : fallback;
}

export function jsonNoStore(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
