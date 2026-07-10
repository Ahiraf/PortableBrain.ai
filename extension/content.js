/*
 * On-page memory assistant for AI chat sites. Adds a floating 🧠 button; open
 * it to see the memories most relevant to what you're typing and inject them
 * into the chat box in one click — so you stop re-explaining yourself.
 *
 * All backend calls go through the background worker (page CSP would otherwise
 * block cross-origin fetches on sites like ChatGPT).
 */
(function () {
  if (window.__pbLoaded) return;
  window.__pbLoaded = true;

  const site = (PB_SITES || []).find(
    (s) => location.hostname === s.host || location.hostname.endsWith("." + s.host)
  );

  // --- input resolution ------------------------------------------------------
  function findInput() {
    const active = document.activeElement;
    if (active && isEditable(active)) return active;
    for (const sel of (site && site.selectors) || []) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // Generic fallback: largest visible textarea / contenteditable.
    const cands = [...document.querySelectorAll("textarea, [contenteditable='true']")]
      .filter((el) => el.offsetParent && el.getBoundingClientRect().width > 120);
    cands.sort((a, b) => area(b) - area(a));
    return cands[0] || null;
  }
  const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
  const isEditable = (el) =>
    el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);

  function getDraft(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    return el.innerText || "";
  }

  function injectIntoInput(el, block) {
    if (!el) return false;
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value").set;
      setter.call(el, block + (el.value || ""));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    // contenteditable (ProseMirror, Quill, etc.): insert at the very start.
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    if (document.execCommand("insertText", false, block)) return true;
    el.textContent = block + el.textContent;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return true;
  }

  // --- messaging helper ------------------------------------------------------
  const send = (msg) =>
    new Promise((resolve) => {
      try { chrome.runtime.sendMessage(msg, (r) => resolve(r || { ok: false, error: "no response" })); }
      catch (e) { resolve({ ok: false, error: e.message }); }
    });

  // --- UI --------------------------------------------------------------------
  const hostEl = document.createElement("div");
  hostEl.style.cssText = "position:fixed;z-index:2147483647;";
  (document.body || document.documentElement).appendChild(hostEl);
  const root = hostEl.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
      .fab{position:fixed;right:20px;bottom:96px;width:46px;height:46px;border-radius:50%;
        border:0;cursor:pointer;font-size:22px;color:#0b0f1a;
        background:linear-gradient(135deg,#7c9cff,#b98bff);box-shadow:0 8px 24px rgba(124,156,255,.45)}
      .fab:hover{transform:translateY(-1px)}
      .panel{position:fixed;right:20px;bottom:152px;width:360px;max-height:70vh;overflow:auto;
        background:#121826;color:#e8ecf5;border:1px solid #232c40;border-radius:16px;
        box-shadow:0 20px 60px rgba(0,0,0,.5);display:none}
      .panel.open{display:block}
      .hd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #232c40}
      .hd b{font-size:14px;flex:1}
      .x{cursor:pointer;color:#93a0bd;font-size:16px}.x:hover{color:#fff}
      .body{padding:12px 14px}
      .muted{color:#93a0bd;font-size:12px}
      .mem{border:1px solid #232c40;border-radius:10px;padding:9px 10px;margin-top:8px;background:#1a2233;display:flex;gap:8px;align-items:start}
      .mem input{margin-top:2px}
      .mem .t{font-size:13px;line-height:1.45}
      .mem .s{font-size:10px;color:#3ecf8e}
      .row{display:flex;gap:8px;margin-top:12px}
      button.act{flex:1;border:0;border-radius:9px;padding:9px;font-weight:700;cursor:pointer;font-size:13px;
        background:linear-gradient(135deg,#7c9cff,#b98bff);color:#0b0f1a}
      button.gh{background:transparent;color:#e8ecf5;border:1px solid #232c40;font-weight:600}
      button.gh:hover{border-color:#7c9cff}
      input.add{width:100%;margin-top:12px;background:#1a2233;border:1px solid #232c40;color:#e8ecf5;border-radius:9px;padding:9px;font-size:13px;outline:none}
      input.add:focus{border-color:#7c9cff}
      a{color:#7c9cff;text-decoration:none;font-size:12px}
      .toast{margin-top:10px;font-size:12px;color:#3ecf8e}
    </style>
    <button class="fab" id="fab" title="PortableBrain">🧠</button>
    <div class="panel" id="panel">
      <div class="hd"><b>🧠 Relevant memories</b><span class="x" id="close">✕</span></div>
      <div class="body">
        <div class="muted" id="status">Reading your draft…</div>
        <div id="list"></div>
        <div class="row">
          <button class="act" id="insert">Insert into chat</button>
          <button class="gh" id="copy">Copy</button>
        </div>
        <input class="add" id="addbox" placeholder="+ Remember something (press Enter)" />
        <div class="row" style="margin-top:10px">
          <a id="dash" href="#" target="_blank">Open dashboard ↗</a>
        </div>
        <div class="toast" id="toast"></div>
      </div>
    </div>`;

  const $ = (id) => root.getElementById(id);
  let currentHits = [];

  $("fab").addEventListener("click", () => {
    const p = $("panel");
    p.classList.toggle("open");
    if (p.classList.contains("open")) refresh();
  });
  $("close").addEventListener("click", () => $("panel").classList.remove("open"));

  async function refresh() {
    $("toast").textContent = "";
    const draft = getDraft(findInput());
    $("status").textContent = draft.trim()
      ? "Ranked against what you're typing:"
      : "Your always-on memories:";
    const r = await send({ type: "retrieve", context: draft, k: 6 });
    if (!r.ok) {
      $("status").textContent = "Can't reach the backend. Set its URL in the toolbar popup.";
      $("list").innerHTML = "";
      return;
    }
    currentHits = r.data.memories || [];
    renderList();
    setDashLink();
  }

  function renderList() {
    const list = $("list");
    if (!currentHits.length) {
      list.innerHTML = `<div class="muted" style="margin-top:8px">No memories yet. Add some below or on the dashboard.</div>`;
      return;
    }
    list.innerHTML = currentHits
      .map((m, i) => `
        <label class="mem">
          <input type="checkbox" data-i="${i}" ${m.pinned || m.score > 0.12 ? "checked" : ""}/>
          <div><div class="t">${esc(m.text)}</div>
          <div class="s">${m.pinned ? "pinned" : "score " + (m.score || 0).toFixed(2)}</div></div>
        </label>`)
      .join("");
  }

  function selectedBlock() {
    const boxes = [...root.querySelectorAll('input[type="checkbox"]')];
    const picked = boxes.filter((b) => b.checked).map((b) => currentHits[+b.dataset.i]);
    if (!picked.length) return "";
    return "Context about me (from my personal memory):\n" +
      picked.map((m) => "- " + m.text).join("\n") + "\n\n";
  }

  $("insert").addEventListener("click", () => {
    const block = selectedBlock();
    if (!block) return toast("Select at least one memory.");
    const el = findInput();
    if (!el) return toast("Couldn't find the chat input on this page.");
    injectIntoInput(el, block);
    $("panel").classList.remove("open");
  });

  $("copy").addEventListener("click", async () => {
    const block = selectedBlock();
    if (!block) return toast("Select at least one memory.");
    try { await navigator.clipboard.writeText(block); toast("Copied to clipboard."); }
    catch { toast("Copy failed — insert instead."); }
  });

  $("addbox").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || !e.target.value.trim()) return;
    const text = e.target.value.trim();
    e.target.value = "";
    const r = await send({ type: "addMemory", memory: { text, category: "fact", source: "in-chat" } });
    toast(r.ok ? "Saved." : "Save failed: " + r.error);
    if (r.ok) refresh();
  });

  async function setDashLink() {
    const s = await send({ type: "getSettings" });
    if (s.ok) $("dash").href = s.data.backend;
  }

  function toast(t) { $("toast").textContent = t; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
