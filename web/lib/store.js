// File-backed memory store. One JSON file, no database to set up.
// Each memory is an atomic fact about the user; the extension retrieves the
// most relevant ones per AI-chat context and injects them.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "memories.json");

// A small seed so a fresh install demonstrates retrieval immediately.
const SEED = [
  { text: "I'm a full-stack developer who prefers TypeScript, Next.js, and Tailwind CSS.", category: "preference", tags: ["stack", "coding"], pinned: true },
  { text: "Always give me concise answers first, then details only if I ask.", category: "preference", tags: ["style"], pinned: true },
  { text: "I'm building a personal AI memory layer that injects context into any chat.", category: "project", tags: ["memory-layer"], pinned: false },
  { text: "My timezone is Asia/Dhaka (GMT+6).", category: "fact", tags: ["logistics"], pinned: true },
  { text: "For data work I use Python with pandas and scikit-learn.", category: "preference", tags: ["stack", "ml"], pinned: false },
];

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
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
    await fs.writeFile(FILE, JSON.stringify(seeded, null, 2));
  }
}

export async function readAll() {
  await ensureFile();
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

async function writeAll(memories) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(memories, null, 2));
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
  await writeAll(memories);
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
  await writeAll(memories);
  return memories[i];
}

export async function deleteMemory(id) {
  const memories = await readAll();
  const next = memories.filter((m) => m.id !== id);
  const removed = next.length !== memories.length;
  if (removed) await writeAll(next);
  return removed;
}
