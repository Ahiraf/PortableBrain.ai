<div align="center">

# 🧠 PortableBrain.ai

**Your memory, in every AI.**

A personal AI memory that follows you everywhere. One persistent store of your
**preferences, projects, and facts** that auto-injects the *relevant* bits into
whatever AI chat you open — so you stop re-explaining yourself to every model
(ChatGPT, Claude, Gemini, Copilot, Perplexity, DeepSeek, Grok).

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Redis](https://img.shields.io/badge/Upstash_Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com)

</div>

---

## 🔄 How It Works

```
   You type in an AI chat  ──▶  extension reads your draft
                                        │
                                        ▼
        Next.js backend  ◀──  POST /api/retrieve { context }
        (RAG retrieval)   ──▶  the top-k most relevant memories
                                        │
                                        ▼
              extension injects a compact "Context about me:" block
              into the chat box  ──▶  the model now knows you
```

---

## ✨ Features

![Local RAG](https://img.shields.io/badge/Local_RAG_Retrieval-0F9D58?style=flat-square) &nbsp; A TF-IDF + cosine-similarity model ranks your memories against the current prompt — no embeddings API, no keys, works offline.

![Every AI Chat](https://img.shields.io/badge/Works_in_Every_AI_Chat-4285F4?style=flat-square&logo=googlechrome&logoColor=white) &nbsp; One extension injects the right memories into ChatGPT, Claude, Gemini, Copilot, Perplexity, DeepSeek, Grok.

![Pinned Memories](https://img.shields.io/badge/Pinned_Memories-EDC22E?style=flat-square) &nbsp; Role, timezone, and hard preferences are always injected; everything else only when relevant.

![Smart Capture](https://img.shields.io/badge/Smart_Capture_(OpenAI/Claude)-412991?style=flat-square&logo=openai&logoColor=white) &nbsp; Paste a paragraph or a whole chat and an LLM distils it into clean, atomic memories.

![Privacy First](https://img.shields.io/badge/Privacy_First-546E7A?style=flat-square) &nbsp; Memories live in a local JSON file; no open CORS; only what you inject reaches a model.

---

## 🧰 Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Backend + dashboard | Next.js (App Router) |
| Retrieval | Local TF-IDF + cosine similarity (`lib/retrieval.js`) |
| Store | File-backed JSON (no DB) · optional Upstash Redis |
| Smart capture (optional) | OpenAI (free-tier friendly) or Claude — provider-agnostic |
| Extension | Chrome/Brave/Edge/Opera (Manifest V3) |

---

## 🚀 Setup

### 1. Run the backend

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

The dashboard lets you add / pin / delete memories and **test retrieval live**.
A few seed memories are created on first run.

**Optional — smart capture:** copy `.env.example` to `.env.local` and set **one**
of `OPENAI_API_KEY` (free-tier friendly) or `ANTHROPIC_API_KEY`. If both are set,
`EXTRACTION_PROVIDER` (`openai` | `anthropic`) decides. Without a key, everything
except smart capture still works.

### 2. Load the extension (Chrome / Brave / Edge / Opera)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** → select the `extension/` folder.
4. Open the 🧠 toolbar popup and confirm it says **Connected**.

### 3. Use it

- Open any AI chat and click the floating **🧠** button (bottom-right).
- Tick the memories you want and hit **Insert into chat**.
- **Highlight text anywhere → right-click → "Remember this"** to capture a memory.

---

## 🔌 API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/retrieve` | `{ context, k }` → ranked memories + a ready-to-paste block (the hot path) |
| `GET /api/memories` | list all memories |
| `POST /api/memories` | add one `{ text, category, tags, pinned }` |
| `PATCH /api/memories/:id` | edit / pin |
| `DELETE /api/memories/:id` | delete |
| `GET /api/extract` | is smart capture available? |
| `POST /api/extract` | `{ text }` → LLM-extracted memories (saved) |

---

## 🔒 Security

- **No open CORS** — a random website can't read your memory store.
- **Optional token auth** — set `PB_TOKEN` to require it (constant-time compare).
- **Abuse guards** — `/api/extract` is rate-limited and input-capped so credits can't be drained.
- **Security headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.

---

## 📁 Project Structure

```
web/                     Next.js backend + dashboard (memory store + RAG)
  lib/store.js           file-backed memory store (JSON, no DB)
  lib/retrieval.js       RAG core: TF-IDF ranking + context block
  app/api/               memories, retrieve, extract endpoints
  app/page.js            dashboard: add / pin / delete + live retrieval test
extension/               the browser extension (load unpacked)
  background.js          proxies backend calls, right-click "remember this"
  content.js             the in-chat panel + memory injection
```

---

## 🗺️ Roadmap

Per-model injection rules · auto-inject on send · memory decay/aging ·
multi-device sync · dedup of near-identical memories · semantic embeddings
(swap `embed()` in `lib/retrieval.js`).
