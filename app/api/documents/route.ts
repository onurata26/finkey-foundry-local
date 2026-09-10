import { indexDocumentFile } from "../../lib/rag/ingest.ts";
import { MAX_DOCUMENT_BYTES } from "../../lib/rag/ingest.ts";
import { getRagStore } from "../../lib/rag/store.ts";
import {
  declaredBodyLength,
  isSameOrigin,
  jsonNoStore,
  safeError,
} from "../../lib/http-security.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_MULTIPART_BYTES = MAX_DOCUMENT_BYTES + 512 * 1024;

export async function GET(): Promise<Response> {
  return jsonNoStore({ ok: true, documents: getRagStore().listDocuments() });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ ok: false, error: "Cross-origin uploads are not allowed." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    return jsonNoStore({ ok: false, error: "Expected a multipart document upload." }, 415);
  }
  const contentLength = declaredBodyLength(request);
  if (contentLength == null) {
    return jsonNoStore({ ok: false, error: "A valid Content-Length header is required." }, 411);
  }
  if (contentLength > MAX_MULTIPART_BYTES) {
    return jsonNoStore({ ok: false, error: "The upload request is too large." }, 413);
  }
  try {
    const form = await request.formData();
    const files = form.getAll("file");
    const file = files[0];
    if (files.length !== 1 || !(file instanceof File)) {
      return jsonNoStore({ ok: false, error: "Exactly one document file is required." }, 400);
    }
    const result = await indexDocumentFile(file);
    return jsonNoStore({ ok: true, ...result }, result.duplicate ? 200 : 201);
  } catch (error) {
    return jsonNoStore({ ok: false, error: safeError(error, "The document could not be indexed.") }, 400);
  }
}
