/*
 * Background service worker. All backend calls funnel through here — content
 * scripts on sites like ChatGPT run under a strict page CSP that blocks
 * cross-origin fetches, but the worker isn't bound by it (it has host
 * permissions). It also owns settings and the right-click "remember this".
 */
importScripts("config.js");

async function getBackend() {
  const { backend } = await chrome.storage.local.get("backend");
  return (backend || PB_CONFIG.defaultBackend).replace(/\/+$/, "");
}

async function api(path, options) {
  const base = await getBackend();
  const { token } = await chrome.storage.local.get("token");
  const res = await fetch(base + path, {
    ...options,
    headers: {
      "content-type": "application/json",
      // Sent only if the backend is protected with PB_TOKEN.
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options && options.headers),
    },
  });
  if (res.status === 401) throw new Error("Unauthorized — check the access token in the popup.");
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  return res.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "retrieve") {
        sendResponse({ ok: true, data: await api("/api/retrieve", { method: "POST", body: JSON.stringify({ context: msg.context || "", k: msg.k || 5 }) }) });
      } else if (msg.type === "listMemories") {
        sendResponse({ ok: true, data: await api("/api/memories") });
      } else if (msg.type === "addMemory") {
        sendResponse({ ok: true, data: await api("/api/memories", { method: "POST", body: JSON.stringify(msg.memory) }) });
      } else if (msg.type === "getSettings") {
        const { backend, token } = await chrome.storage.local.get(["backend", "token"]);
        sendResponse({ ok: true, data: { backend: backend || PB_CONFIG.defaultBackend, token: token || "" } });
      } else if (msg.type === "setSettings") {
        const patch = {};
        if (typeof msg.backend === "string") patch.backend = msg.backend;
        if (typeof msg.token === "string") patch.token = msg.token;
        await chrome.storage.local.set(patch);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // async response
});

// Right-click selected text anywhere -> save it as a memory.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "aiml-remember",
    title: "Remember this (PortableBrain)",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "aiml-remember" || !info.selectionText) return;
  try {
    await api("/api/memories", {
      method: "POST",
      body: JSON.stringify({ text: info.selectionText.trim(), category: "fact", source: "highlight" }),
    });
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#3ecf8e" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1500);
  } catch (e) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#d93025" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
  }
});
