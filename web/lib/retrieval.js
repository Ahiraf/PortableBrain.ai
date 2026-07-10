/*
 * The RAG core. Given the text you're about to send to an AI chat, rank stored
 * memories by relevance and return the top matches — so the right context is
 * injected without you re-explaining yourself.
 *
 * Retrieval runs 100% locally with a TF-IDF + cosine-similarity vector model —
 * no embeddings API, no keys, works offline. It's small and fast for a personal
 * memory set (hundreds of items). The scoring is intentionally simple and
 * swappable: point `embed()` at Voyage/OpenAI later without touching callers.
 */

const STOPWORDS = new Set(
  ("a an and are as at be but by for from has have i in is it its me my of on or " +
    "so that the their them then there they this to was we were what when which who " +
    "will with you your do does did can could should would about into over out up " +
    "if not no yes just also more most some any all how why").split(" ")
);

export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function termFreq(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

// Inverse document frequency across the memory corpus.
function buildIdf(docsTokens) {
  const df = new Map();
  for (const toks of docsTokens) {
    for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = docsTokens.length || 1;
  const idf = new Map();
  for (const [t, d] of df) idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
  return idf;
}

function toVector(tokens, idf) {
  const tf = termFreq(tokens);
  const vec = new Map();
  let norm = 0;
  for (const [t, f] of tf) {
    const w = (1 + Math.log(f)) * (idf.get(t) || Math.log(2) + 1);
    vec.set(t, w);
    norm += w * w;
  }
  norm = Math.sqrt(norm) || 1;
  for (const t of vec.keys()) vec.set(t, vec.get(t) / norm);
  return vec;
}

function cosine(a, b) {
  // Iterate the smaller vector for speed.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of small) {
    const o = large.get(t);
    if (o) dot += w * o;
  }
  return dot;
}

/**
 * Rank memories by relevance to `context`.
 * @param {string} context  The draft prompt / current AI-chat context.
 * @param {Array}  memories Stored memory objects.
 * @param {object} opts     { k, minScore, includePinned }
 * @returns {Array} memories decorated with a `score`, best first.
 */
export function retrieve(context, memories, opts = {}) {
  const { k = 5, minScore = 0.04, includePinned = true } = opts;
  if (!memories.length) return [];

  const docsTokens = memories.map((m) =>
    tokenize(`${m.text} ${(m.tags || []).join(" ")} ${m.category || ""}`)
  );
  const idf = buildIdf(docsTokens);
  const queryVec = toVector(tokenize(context), idf);

  const scored = memories.map((m, i) => ({
    ...m,
    score: queryVec.size ? cosine(toVector(docsTokens[i], idf), queryVec) : 0,
  }));

  // Pinned memories (core identity/preferences) are always worth injecting;
  // float them in even if the current prompt doesn't lexically match.
  const pinned = includePinned ? scored.filter((m) => m.pinned) : [];
  const matched = scored
    .filter((m) => m.score >= minScore && !(includePinned && m.pinned))
    .sort((a, b) => b.score - a.score);

  const out = [];
  const seen = new Set();
  for (const m of [...pinned, ...matched]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
    if (out.length >= k) break;
  }
  return out;
}

/** Format selected memories into a compact block to prepend to a prompt. */
export function formatContextBlock(memories) {
  if (!memories.length) return "";
  const lines = memories.map((m) => `- ${m.text}`);
  return `Context about me (from my personal memory):\n${lines.join("\n")}\n\n`;
}
