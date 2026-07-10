/*
 * Anthropic (Claude) extraction provider. Uses the official Anthropic SDK with
 * Claude Opus 4.8, adaptive thinking, and structured outputs.
 * Enabled when ANTHROPIC_API_KEY is set.
 */
import Anthropic from "@anthropic-ai/sdk";
import { SCHEMA, SYSTEM, userPrompt, normalizeMemories } from "./extract-shared";

export function anthropicAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function extractWithClaude(text) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: userPrompt(text) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The request was declined by the model's safety system.");
  }
  const block = response.content.find((b) => b.type === "text");
  return normalizeMemories(JSON.parse(block ? block.text : '{"memories":[]}'));
}
