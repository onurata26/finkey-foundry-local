import { answerFromDocuments } from "../../lib/rag/answer.ts";
import {
  isSameOrigin,
  jsonNoStore,
  readLimitedText,
  safeError,
} from "../../lib/http-security.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_RAG_REQUEST_BYTES = 8 * 1024;

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ ok: false, error: "Cross-origin requests are not allowed." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonNoStore({ ok: false, error: "Expected an application/json request." }, 415);
  }

  const rawBody = await readLimitedText(request, MAX_RAG_REQUEST_BYTES).catch(() => null);
  if (rawBody == null) return jsonNoStore({ ok: false, error: "The request body is too large or invalid." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonNoStore({ ok: false, error: "The request body must be valid JSON." }, 400);
  }
  if (!isQuestionBody(body)) {
    return jsonNoStore({ ok: false, error: "A question is required." }, 400);
  }

  try {
    const result = await answerFromDocuments(body.question, body.documentId);
    return jsonNoStore({ ok: true, ...result });
  } catch (error) {
    const message = safeError(error, "The local document answer could not be generated.");
    if (/question must|select an indexed document|different embedding model|does not contain searchable text/iu.test(message)) {
      return jsonNoStore({ ok: false, error: message }, 400);
    }
    return jsonNoStore({ ok: false, error: message }, 503);
  }
}

function isQuestionBody(value: unknown): value is { question: string; documentId: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2
    && typeof record.question === "string"
    && record.question.trim().length >= 1
    && record.question.length <= 2_000
    && typeof record.documentId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(record.documentId);
}
