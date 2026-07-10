const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (x) => r(x || { ok: false, error: "no response" })));

function setStatus(text, cls) {
  const s = $("status");
  s.textContent = text;
  s.className = "status" + (cls ? " " + cls : "");
}

async function init() {
  const s = await send({ type: "getSettings" });
  const backend = (s.ok && s.data.backend) || PB_CONFIG.defaultBackend;
  $("backend").value = backend;
  $("token").value = (s.ok && s.data.token) || "";
  $("dash").href = backend;
  test();
}

$("save").addEventListener("click", async () => {
  const backend = $("backend").value.trim().replace(/\/+$/, "");
  const token = $("token").value.trim();
  await send({ type: "setSettings", backend, token });
  $("dash").href = backend;
  setStatus("Saved.", "ok");
  test();
});

$("test").addEventListener("click", test);

async function test() {
  setStatus("Checking backend…");
  const r = await send({ type: "listMemories" });
  if (!r.ok) {
    setStatus("Can't reach backend. Is `npm run dev` running?", "err");
    $("list").innerHTML = "";
    return;
  }
  const mems = r.data.memories || [];
  setStatus(`Connected · ${mems.length} memories`, "ok");
  $("list").innerHTML = mems
    .slice(0, 5)
    .map((m) => `<div class="m">${(m.pinned ? "★ " : "") + esc(m.text)}</div>`)
    .join("");
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

init();
