/*
 * Provider-agnostic "smart capture" dispatcher. Point it at OpenAI or Claude
 * (or add more) — callers don't care which model does the work.
 *
 * Selection order:
 *   1. EXTRACTION_PROVIDER env ("openai" | "anthropic"), if that key exists.
 *   2. Otherwise the first provider whose key is configured (OpenAI first).
 */
import { MAX_INPUT_CHARS } from "./extract-shared";
import { openaiAvailable, extractWithOpenAI } from "./openai";
import { anthropicAvailable, extractWithClaude } from "./anthropic";

const PROVIDERS = {
  openai: { available: openaiAvailable, run: extractWithOpenAI, label: "OpenAI" },
  anthropic: { available: anthropicAvailable, run: extractWithClaude, label: "Claude" },
};

function activeProvider() {
  const configured = Object.keys(PROVIDERS).filter((k) => PROVIDERS[k].available());
  const preferred = (process.env.EXTRACTION_PROVIDER || "").toLowerCase();
  if (preferred && configured.includes(preferred)) return preferred;
  return configured[0] || null;
}

export function extractionStatus() {
  const active = activeProvider();
  return {
    available: !!active,
    provider: active,
    label: active ? PROVIDERS[active].label : null,
    configured: Object.keys(PROVIDERS).filter((k) => PROVIDERS[k].available()),
  };
}

export async function extractMemories(text) {
  const clean = String(text || "").slice(0, MAX_INPUT_CHARS);
  const active = activeProvider();
  if (!active) throw new Error("No extraction provider configured.");
  return PROVIDERS[active].run(clean);
}
