import { readAll } from "../../../lib/store";
import { retrieve, formatContextBlock } from "../../../lib/retrieval";
import { checkAuth } from "../../../lib/auth";

// The extension's hot path: given the text you're about to send to an AI chat,
// return the memories worth injecting, plus a ready-to-paste context block.
export async function POST(req) {
  const denied = checkAuth(req);
  if (denied) return denied;
  try {
    const { context = "", k = 5, minScore, includePinned } = await req.json();
    const memories = await readAll();
    const hits = retrieve(context, memories, {
      k: Math.min(Math.max(Number(k) || 5, 1), 20),
      ...(minScore != null ? { minScore } : {}),
      ...(includePinned != null ? { includePinned } : {}),
    });
    return Response.json({ memories: hits, block: formatContextBlock(hits) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
