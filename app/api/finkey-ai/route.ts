import { handleFinkeyAiPost } from "../../lib/finkey-ai-server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleFinkeyAiPost(request);
}
