"use client";
import { useEffect, useState } from "react";

const CATEGORIES = ["preference", "fact", "project", "skill", "goal"];

export default function Home() {
  const [memories, setMemories] = useState([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("preference");
  const [pinned, setPinned] = useState(false);
  const [smartAvailable, setSmartAvailable] = useState(false);
  const [smartLabel, setSmartLabel] = useState("");
  const [capture, setCapture] = useState("");
  const [busy, setBusy] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testHits, setTestHits] = useState(null);

  async function load() {
    const r = await fetch("/api/memories");
    const d = await r.json();
    setMemories(d.memories || []);
  }
  useEffect(() => {
    load();
    fetch("/api/extract").then((r) => r.json()).then((d) => {
      setSmartAvailable(!!d.available);
      setSmartLabel(d.label || "");
    });
  }, []);

  async function add() {
    if (!text.trim()) return;
    await fetch("/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, category, pinned }),
    });
    setText(""); setPinned(false);
    load();
  }

  async function remove(id) {
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    load();
  }

  async function togglePin(m) {
    await fetch(`/api/memories/${m.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: !m.pinned }),
    });
    load();
  }

  async function smartCapture() {
    if (!capture.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: capture }),
      });
      const d = await r.json();
      if (d.error) alert(d.error);
      else setCapture("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    const r = await fetch("/api/retrieve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ context: testQuery, k: 5 }),
    });
    const d = await r.json();
    setTestHits(d);
  }

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo">🧠</div>
        <div>
          <h1>PortableBrain<span style={{ color: "var(--muted)", fontWeight: 400 }}>.ai</span></h1>
          <p className="tagline" style={{ fontWeight: 700, color: "var(--text)", fontSize: 15, margin: "6px 0 0" }}>Your memory, in every AI.</p>
          <p className="tagline">One persistent memory of your preferences, projects and facts — auto-injected into whatever AI chat you open.</p>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <h2>Add a memory</h2>
          <textarea placeholder="e.g. I prefer dark mode and terse explanations." value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row" style={{ marginTop: 10 }}>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} style={{ width: 16, height: 16 }} />
              pin (always inject)
            </label>
            <button className="grow" onClick={add}>Save memory</button>
          </div>
        </div>

        <div className="card">
          <h2>Smart capture {smartAvailable ? <span className="muted">· via {smartLabel}</span> : <span className="muted">· needs OPENAI_API_KEY or ANTHROPIC_API_KEY</span>}</h2>
          <textarea placeholder="Paste a paragraph or a whole chat — Claude distils it into atomic memories." value={capture} onChange={(e) => setCapture(e.target.value)} disabled={!smartAvailable} />
          <button style={{ marginTop: 10 }} onClick={smartCapture} disabled={!smartAvailable || busy}>
            {busy ? "Thinking…" : "Extract & save"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Test retrieval <span className="muted">— what would get injected for a given prompt</span></h2>
        <div className="row">
          <input className="grow" placeholder="Type a prompt, e.g. 'help me set up a new web project'" value={testQuery} onChange={(e) => setTestQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runTest()} />
          <button className="ghost" onClick={runTest}>Retrieve</button>
        </div>
        {testHits && (
          <>
            {testHits.memories.length === 0 ? (
              <p className="muted" style={{ marginTop: 10 }}>No relevant memories.</p>
            ) : testHits.memories.map((m) => (
              <div key={m.id} className="mem">
                <div className="top"><div className="text">{m.text}</div></div>
                <div className="meta">
                  <span className="pill cat">{m.category}</span>
                  {m.pinned && <span className="pill">pinned</span>}
                  <span className="pill score">score {m.score.toFixed(3)}</span>
                </div>
              </div>
            ))}
            {testHits.block && <div className="pre mono">{testHits.block.trim()}</div>}
          </>
        )}
      </div>

      <div className="card">
        <h2>Your memories <span className="count">· {memories.length}</span></h2>
        {memories.length === 0 && <p className="muted">No memories yet.</p>}
        {memories.map((m) => (
          <div key={m.id} className="mem">
            <div className="top">
              <div className="text">{m.text}</div>
              <button className={"iconbtn" + (m.pinned ? " pinned" : "")} title={m.pinned ? "Unpin" : "Pin"} onClick={() => togglePin(m)}>{m.pinned ? "★" : "☆"}</button>
              <button className="iconbtn" title="Delete" onClick={() => remove(m.id)}>✕</button>
            </div>
            <div className="meta">
              <span className="pill cat">{m.category}</span>
              {(m.tags || []).map((t) => <span key={t} className="pill">{t}</span>)}
              <span className="pill">{m.source}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="muted">
        API: <span className="code">POST /api/retrieve</span> · <span className="code">GET/POST /api/memories</span> — the browser extension calls these to inject the right memories into any AI chat.
      </p>
    </div>
  );
}
