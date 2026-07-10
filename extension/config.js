/* Runtime config shared across extension contexts. */
globalThis.PB_CONFIG = {
  // Where the Next.js memory backend lives. Point this at your deployed app in
  // production; the popup lets you override it and stores the value.
  defaultBackend: "http://localhost:3000",
};

// Per-site selectors for the chat input box, tried in order. First hit wins.
// Falls back to the focused editable element or the largest textarea on the page.
globalThis.PB_SITES = [
  { host: "chatgpt.com", name: "ChatGPT", selectors: ["#prompt-textarea", "div[contenteditable='true']", "textarea"] },
  { host: "chat.openai.com", name: "ChatGPT", selectors: ["#prompt-textarea", "div[contenteditable='true']", "textarea"] },
  { host: "claude.ai", name: "Claude", selectors: ["div[contenteditable='true']", "div.ProseMirror", "textarea"] },
  { host: "gemini.google.com", name: "Gemini", selectors: ["div.ql-editor[contenteditable='true']", "rich-textarea .textarea", "textarea"] },
  { host: "copilot.microsoft.com", name: "Copilot", selectors: ["textarea#userInput", "textarea", "div[contenteditable='true']"] },
  { host: "perplexity.ai", name: "Perplexity", selectors: ["textarea", "div[contenteditable='true']"] },
  { host: "chat.deepseek.com", name: "DeepSeek", selectors: ["textarea#chat-input", "textarea", "div[contenteditable='true']"] },
  { host: "grok.com", name: "Grok", selectors: ["textarea", "div[contenteditable='true']"] },
];
