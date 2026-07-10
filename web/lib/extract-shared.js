/*
 * Shared pieces for "smart capture" — the schema, system prompt, input cap, and
 * output normaliser used by every extraction provider (OpenAI, Anthropic, …).
 * Keeping them here means providers only differ in the API call itself.
 */

// Hard cap on how much text one extraction may process — protects paid credits
// and keeps latency sane.
export const MAX_INPUT_CHARS = 20000;

export const SCHEMA = {
  type: "object",
  properties: {
    memories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          category: { type: "string", enum: ["preference", "fact", "project", "skill", "goal"] },
          tags: { type: "array", items: { type: "string" } },
          pinned: { type: "boolean" },
        },
        required: ["text", "category", "tags", "pinned"],
        additionalProperties: false,
      },
    },
  },
  required: ["memories"],
  additionalProperties: false,
};

export const SYSTEM = `You extract durable, reusable "memories" about a user from text they paste.
A memory is a single atomic fact, preference, skill, project, or goal that would be useful to
inject into a future AI conversation so the user doesn't have to re-explain themselves.

Rules:
- One idea per memory. Split compound statements.
- Write each in the first person ("I prefer...", "I'm working on...").
- Keep only durable facts. Drop transient chit-chat, one-off questions, and anything time-bound.
- pinned=true only for core identity/preferences that are almost always relevant
  (role, timezone, hard stylistic preferences). Everything else pinned=false.
- Choose the closest category. Add 1-4 short lowercase tags.
- If nothing is worth remembering, return an empty array.`;

export function userPrompt(text) {
  return `Extract memories from this text:\n\n${text}`;
}

// Coerce whatever the model returned into safe, well-formed memory objects.
export function normalizeMemories(parsed) {
  const list = parsed && Array.isArray(parsed.memories) ? parsed.memories : [];
  const cats = new Set(["preference", "fact", "project", "skill", "goal"]);
  return list
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .slice(0, 50)
    .map((m) => ({
      text: m.text.trim().slice(0, 2000),
      category: cats.has(m.category) ? m.category : "fact",
      tags: Array.isArray(m.tags) ? m.tags.filter((t) => typeof t === "string").slice(0, 6) : [],
      pinned: !!m.pinned,
    }));
}
