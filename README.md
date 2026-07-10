# 🧠 PortableBrain.ai

**Your memory, in every AI.**

A personal AI memory that follows you everywhere. One persistent store of your
**preferences, projects, and facts** that auto-injects the *relevant* bits into
whatever AI chat you open — so you stop re-explaining yourself to every model.

This is the missing primitive: your context lives in **one** place, and a
browser extension pulls the right slice of it into ChatGPT, Claude, Gemini,
Copilot, Perplexity, DeepSeek, Grok — any chat — with one click.

---

## How it works

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

- **Retrieval is real RAG, but runs 100% locally** — a TF-IDF + cosine-similarity
  vector model ranks your memories against the current prompt. No embeddings
  API, no keys, works offline. It's small and fast for a personal memory set,
  and the scoring is swappable for hosted embeddings later (`lib/retrieval.js`).
- **Pinned memories** (role, timezone, hard preferences) are always injected;
  everything else is injected only when it's relevant to what you're typing.
- **Smart capture (optional)** — paste a paragraph or a whole chat and an LLM
  distils it into clean, atomic memories. Provider-agnostic: use **OpenAI**
  (`OPENAI_API_KEY`, free-tier friendly) or **Claude** (`ANTHROPIC_API_KEY`).
  Enabled only when a key is set; the rest of the app needs no key.

---

## Project layout

```
PortableBrain/
├── web/                     ← Next.js backend + dashboard (the memory store + RAG)
│   ├── lib/
│   │   ├── store.js         ← file-backed memory store (JSON, no DB)
│   │   ├── retrieval.js     ← the RAG core: TF-IDF ranking + context block
│   │   └── anthropic.js     ← optional Claude-powered "smart capture"
│   ├── app/api/
│   │   ├── memories/        ← GET/POST list + add, PATCH/DELETE by id
│   │   ├── retrieve/        ← POST { context } → ranked memories + inject block
│   │   └── extract/         ← POST { text } → Claude-extracted memories
│   └── app/page.js          ← dashboard: add / pin / delete + live retrieval test
└── extension/               ← the browser extension (load this unpacked)
    ├── manifest.json
    ├── background.js         ← proxies backend calls, right-click "remember this"
    ├── content.js           ← the 🧠 in-chat panel + memory injection
    ├── config.js            ← backend URL + per-site input selectors
    ├── popup.html/js         ← backend settings + connection status
    └── icons/
```

## 1. Run the backend

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

The dashboard lets you add/pin/delete memories and **test retrieval** live
(type a prompt, see exactly what would get injected). A few seed memories are
created on first run so retrieval works immediately.

**Optional — smart capture:** copy `.env.example` to `.env.local` and set
**one** of `OPENAI_API_KEY` (free-tier friendly) or `ANTHROPIC_API_KEY`. If both
are set, `EXTRACTION_PROVIDER` (`openai` | `anthropic`) decides. Without a key,
everything except smart capture still works.

## 2. Load the extension (Chrome / Brave / Edge / Opera)

1. Open `chrome://extensions` (or `brave://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** → select the `extension/` folder.
4. Open the toolbar 🧠 popup and confirm it says **Connected** (set the backend
   URL there if you deployed it somewhere other than `localhost:3000`).

## 3. Use it

- Open **ChatGPT / Claude / Gemini / Copilot / Perplexity / DeepSeek / Grok**.
- Click the floating **🧠** button (bottom-right).
- It ranks your memories against whatever you've typed. Tick the ones you want
  and hit **Insert into chat** — a compact context block is prepended to the box.
- **Highlight text anywhere → right-click → "Remember this"** to capture a memory
  without leaving the page.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/retrieve` | `{ context, k }` → ranked memories + a ready-to-paste block. The extension's hot path. |
| `GET /api/memories` | list all memories |
| `POST /api/memories` | add one `{ text, category, tags, pinned }` |
| `PATCH /api/memories/:id` | edit / pin |
| `DELETE /api/memories/:id` | delete |
| `GET /api/extract` | is smart capture available? |
| `POST /api/extract` | `{ text }` → Claude-extracted memories (saved) |

## Security

- **No open CORS.** The API sends no `Access-Control-Allow-Origin: *`, so a
  random website you visit can't read your memory store. The dashboard is
  same-origin; the extension calls through its background worker (host
  permission), so neither needs CORS.
- **Optional token auth.** Set `PB_TOKEN` and the API requires it. The
  dashboard is auto-allowed (identified by `Sec-Fetch-Site: same-origin`); the
  extension must send the same token (set it in the toolbar popup). Comparison
  is constant-time. Leave `PB_TOKEN` blank for a zero-config local run.
- **Abuse guards on the paid endpoint.** `/api/extract` is rate-limited and caps
  input length, so credits can't be drained.
- **Security headers** (`X-Frame-Options: DENY`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: no-referrer`) on every response.

## Notes & roadmap

- **Privacy:** your memories live in `web/data/memories.json` on your machine
  (git-ignored). Only the memories you inject ever reach a model.
- The local retriever is deliberately simple. To upgrade to semantic embeddings,
  implement `embed()` in `lib/retrieval.js` (Anthropic recommends Voyage AI) and
  precompute vectors on write — the API surface stays the same.
- Roadmap: per-model injection rules, auto-inject on send, memory decay/aging,
  multi-device sync, and dedup of near-identical memories.
