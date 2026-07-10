/*
 * Memory store with two interchangeable backends behind one async API:
 *
 *   - Local dev  -> a JSON file (web/data/memories.json). Zero config.
 *   - Production -> Upstash Redis (serverless-friendly, persistent), used
 *                   automatically when UPSTASH_REDIS_REST_URL + _TOKEN are set.
 *
 * Callers (the API routes) don't know or care which backend is active.
 */
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { Redis } from "@upstash/redis";

const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const REDIS_KEY = "portablebrain:memories";
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "memories.json");

let _redis = null;
function redis() {
  if (!_redis) _redis = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL/_TOKEN
  return _redis;
}

// A small seed so a fresh install demonstrates retrieval immediately.
const SEED = [
  { text: "I'm a full-stack developer who prefers TypeScript, Next.js, and Tailwind CSS.", category: "preference", tags: ["stack", "coding"], pinned: true },
  { text: "Always give me concise answers first, then details only if I ask.", category: "preference", tags: ["style"], pinned: true },
  { text: "I'm building a personal AI memory layer that injects context into any chat.", category: "project", tags: ["memory-layer"], pinned: false },
  { text: "My timezone is Asia/Dhaka (GMT+6).", category: "fact", tags: ["logistics"], pinned: true },
  { text: "For data work I use Python with pandas and scikit-learn.", category: "preference", tags: ["stack", "ml"], pinned: false },
];

// ---- low-level backend read/write ----
async function loadRaw() {
  if (useRedis) {
    const data = await redis().get(REDIS_KEY); // Upstash auto-deserializes JSON
    return Array.isArray(data) ? data : null;
  }
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return null;
  }
}

async function saveRaw(memories) {
  if (useRedis) {
    await redis().set(REDIS_KEY, memories);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(memories, null, 2));
}

// ---- public API ----
export async function readAll() {
  const existing = await loadRaw();
  if (existing) return existing;
  const now = Date.now();
  const seeded = SEED.map((m, i) => ({
    id: crypto.randomUUID(),
    text: m.text,
    category: m.category,
    tags: m.tags || [],
    pinned: !!m.pinned,
    source: "seed",
    createdAt: now + i,
  }));
  await saveRaw(seeded);
  return seeded;
}

export async function addMemory({ text, category, tags, pinned, source }) {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("Memory text is required");
  const memories = await readAll();
  const mem = {
    id: crypto.randomUUID(),
    text: clean.slice(0, 2000),
    category: category || "fact",
    tags: Array.isArray(tags) ? tags.slice(0, 12) : [],
    pinned: !!pinned,
    source: source || "manual",
    createdAt: Date.now(),
  };
  memories.push(mem);
  await saveRaw(memories);
  return mem;
}

export async function addMany(items) {
  const created = [];
  for (const it of items) created.push(await addMemory(it));
  return created;
}

export async function updateMemory(id, patch) {
  const memories = await readAll();
  const i = memories.findIndex((m) => m.id === id);
  if (i === -1) return null;
  const allowed = ["text", "category", "tags", "pinned"];
  for (const k of allowed) if (k in patch) memories[i][k] = patch[k];
  await saveRaw(memories);
  return memories[i];
}

export async function deleteMemory(id) {
  const memories = await readAll();
  const next = memories.filter((m) => m.id !== id);
  const removed = next.length !== memories.length;
  if (removed) await saveRaw(next);
  return removed;
}
