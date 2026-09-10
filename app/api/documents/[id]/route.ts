import { getRagStore } from "../../../lib/rag/store.ts";
import { isSameOrigin, jsonNoStore } from "../../../lib/http-security.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ ok: false, error: "Cross-origin requests are not allowed." }, 403);
  }
  const { id } = await context.params;
  const deleted = /^[0-9a-f-]{36}$/iu.test(id) && getRagStore().deleteDocument(id);
  return deleted
    ? jsonNoStore({ ok: true })
    : jsonNoStore({ ok: false, error: "Document not found." }, 404);
}
