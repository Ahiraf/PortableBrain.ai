/*
 * OpenAI extraction provider. Uses the official OpenAI SDK with strict
 * JSON-schema structured outputs so the result is always valid.
 * Enabled when OPENAI_API_KEY is set. Model is configurable via OPENAI_MODEL
 * (default: gpt-4o-mini — cheap and supports structured outputs).
 */
import OpenAI from "openai";
import { SCHEMA, SYSTEM, userPrompt, normalizeMemories } from "./extract-shared";

export function openaiAvailable() {
  return !!process.env.OPENAI_API_KEY;
}

export async function extractWithOpenAI(text) {
  const client = new OpenAI();
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt(text) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "memories", strict: true, schema: SCHEMA },
    },
  });

  const choice = resp.choices && resp.choices[0];
  if (choice && choice.message && choice.message.refusal) {
    throw new Error("The request was declined by the model's safety system.");
  }
  const content = (choice && choice.message && choice.message.content) || '{"memories":[]}';
  return normalizeMemories(JSON.parse(content));
}
