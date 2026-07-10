import { addMany } from "../../../lib/store";
import { extractMemories, extractionStatus } from "../../../lib/extract";
import { checkAuth, rateLimit } from "../../../lib/auth";
import { MAX_INPUT_CHARS } from "../../../lib/extract-shared";

// Tells the UI whether smart capture is wired up, and which provider is active.
export async function GET(req) {
  const denied = checkAuth(req);
  if (denied) return denied;
  return Response.json(extractionStatus());
}

// Paste free text -> chosen provider distils atomic memories -> save them.
export async function POST(req) {
  const denied = checkAuth(req);
  if (denied) return denied;

  // Guard the paid endpoint: cap request rate so credits can't be drained.
  const limited = rateLimit("extract", 20, 60000);
  if (limited) return limited;

  const status = extractionStatus();
  if (!status.available) {
    return Response.json(
      { error: "Smart capture is off. Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable it." },
      { status: 501 }
    );
  }
  try {
    const { text, save = true } = await req.json();
    if (!text || !text.trim()) {
      return Response.json({ error: "text is required" }, { status: 400 });
    }
    if (text.length > MAX_INPUT_CHARS) {
      return Response.json(
        { error: `Text too long (max ${MAX_INPUT_CHARS} characters).` },
        { status: 413 }
      );
    }
    const extracted = await extractMemories(text);
    const memories = save
      ? await addMany(extracted.map((m) => ({ ...m, source: "smart-capture" })))
      : extracted;
    return Response.json({ memories, provider: status.provider });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
