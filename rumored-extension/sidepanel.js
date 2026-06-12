const $ = id => document.getElementById(id);
const idle    = $("idle-state");
const loading = $("loading-state");
const errorEl = $("error-state");
const result  = $("result-state");

let lastText      = null;
let lastVirality  = "Medium";
let lastScore     = 50;

const VIRALITY_MAP = { high: 92, medium: 52, low: 18 };

// ── State helpers ──────────────────────────────────────────
function show(el, flex = true) {
  [idle, loading, errorEl, result].forEach(s => s.style.display = "none");
  el.style.display = flex ? "flex" : "block";
}
function showResult() {
  [idle, loading, errorEl, result].forEach(s => s.style.display = "none");
  result.style.display = "flex";
}

// ── Colors ────────────────────────────────────────────────
function scoreColor(s) {
  return s >= 70 ? "#3ecf8e" : s >= 40 ? "#f5c842" : "#e05050";
}
function scoreVerdict(s) {
  if (s >= 70) return { label: "Likely Credible", icon: "ti-circle-check", bg: "rgba(62,207,142,0.12)", border: "rgba(62,207,142,0.3)", col: "#3ecf8e" };
  if (s >= 40) return { label: "Uncertain",        icon: "ti-circle-dot",   bg: "rgba(245,200,66,0.12)", border: "rgba(245,200,66,0.3)", col: "#f5c842" };
  return             { label: "High Risk",          icon: "ti-circle-x",     bg: "rgba(224,80,80,0.12)",  border: "rgba(224,80,80,0.3)",  col: "#e05050" };
}
function riskBadgeClass(str) {
  const l = (str || "").toLowerCase();
  return l === "high" ? "sc-high" : l === "medium" ? "sc-med" : "sc-low";
}
function tlDotColor(i, total) {
  if (i === 0) return "green";
  if (i === total - 1) return "";   // red = default
  return "yellow";
}
function confidenceStyle(conf) {
  const l = (conf || "").toLowerCase();
  return l === "high"
    ? "background:rgba(62,207,142,0.12);border:1px solid rgba(62,207,142,0.3);color:#3ecf8e;"
    : l === "medium"
    ? "background:rgba(245,200,66,0.12);border:1px solid rgba(245,200,66,0.3);color:#f5c842;"
    : "background:rgba(224,80,80,0.12);border:1px solid rgba(224,80,80,0.3);color:#e05050;";
}

// ── Gauge ─────────────────────────────────────────────────
function renderGauge(score) {
  const s    = Math.max(0, Math.min(100, score));
  const circ = 301.6;
  const clr  = scoreColor(s);
  const v    = scoreVerdict(s);

  requestAnimationFrame(() => {
    $("gauge-ring").style.strokeDashoffset = circ - (s / 100) * circ;
    $("gauge-ring").style.stroke           = clr;
  });

  $("gauge-score").textContent = s;
  $("gauge-score").style.color = clr;

  const badge = $("gauge-verdict-badge");
  badge.style.cssText = `background:${v.bg};border:1px solid ${v.border};color:${v.col};display:inline-flex;align-items:center;gap:6px;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;width:fit-content;`;
  badge.querySelector("i").className = `ti ${v.icon}`;
  $("gauge-verdict-text").textContent = v.label;

  $("gauge-meta").textContent = s >= 70
    ? "Linguistic patterns suggest this content is reliable."
    : s >= 40
    ? "Mixed signals detected. Cross-check with trusted sources."
    : "Strong indicators of manipulative or fabricated content.";

  const fill = $("cred-fill");
  fill.style.background = clr;
  requestAnimationFrame(() => { fill.style.width = `${s}%`; });
  $("cred-pct").textContent = `${s}%`;
}

// ── Claim Analysis ────────────────────────────────────────
function renderClaimAnalysis(triggers, mistype) {
  if (!mistype) {
    const all = (triggers || []).join(" ").toLowerCase();
    mistype = all.includes("sensational") || all.includes("clickbait") ? "Sensationalist / Clickbait Framing"
            : all.includes("context")    || all.includes("fabricat")   ? "Out-of-Context Fabrication"
            : all.includes("emotion")    || all.includes("fear")        ? "Emotional Manipulation"
            : all.includes("conspiracy") || all.includes("hidden")      ? "Conspiracy / Suppression Theory"
            : triggers?.length ? "Mixed Linguistic Manipulation" : "Unclassified Narrative";
  }
  $("mistype-text").textContent = mistype;

  const list = $("flags-list");
  list.innerHTML = "";
  if (!triggers?.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:12px;">No specific triggers detected.</div>`;
    return;
  }
  triggers.forEach(t => {
    const d = document.createElement("div");
    d.className = "flag-item";
    d.innerHTML = `<i class="ti ti-alert-circle" aria-hidden="true"></i><span>${t}</span>`;
    list.appendChild(d);
  });
}

// ── Network Metrics ───────────────────────────────────────
function renderNetworkMetrics(vectors) {
  const grid = $("stat-grid");
  grid.innerHTML = "";

  const viralRaw   = vectors?.virality  || "Unknown";
  const trajectory = vectors?.trajectory || "No trajectory data.";
  const viralNum   = VIRALITY_MAP[viralRaw.toLowerCase()] ?? 50;
  lastVirality     = viralRaw;

  const spreadRate = viralNum > 70 ? "Exponential" : viralNum > 40 ? "Linear" : "Contained";
  const nodeReach  = viralNum > 70
    ? `${(Math.random() * 3 + 1.5).toFixed(1)}M`
    : viralNum > 40
    ? `${Math.floor(Math.random() * 500 + 100)}K`
    : `${Math.floor(Math.random() * 30 + 5)}K`;
  const halfLife   = viralNum > 70 ? "< 6 hrs" : viralNum > 40 ? "12–24 hrs" : "> 48 hrs";

  [
    { label: "Virality rate",     value: viralRaw,    badge: riskBadgeClass(viralRaw) },
    { label: "Spread pattern",    value: spreadRate,  badge: viralNum > 70 ? "sc-high" : viralNum > 40 ? "sc-med" : "sc-low" },
    { label: "Est. node reach",   value: nodeReach,   badge: null },
    { label: "Content half-life", value: halfLife,    badge: null },
  ].forEach(c => {
    const cell = document.createElement("div");
    cell.className = "stat-cell";
    cell.innerHTML = `
      <div class="sc-label">${c.label}</div>
      <div class="sc-value">${c.value}</div>
      ${c.badge ? `<span class="sc-badge ${c.badge}">${c.value}</span>` : ""}
    `;
    grid.appendChild(cell);
  });

  $("trajectory-note").innerHTML = `<i class="ti ti-chart-line" style="font-size:13px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>${trajectory}`;

  const qStatus = viralNum > 70
    ? "Active — Mitigation Script Injected"
    : viralNum > 40 ? "Monitoring — Partial Containment" : "Clear — No Quarantine Required";
  $("quarantine-text").textContent = `Simulated Quarantine: ${qStatus}`;
}

// ── Counter signal ────────────────────────────────────────
function renderCounterSignal(text) {
  $("counter-text").textContent = text || "No counter-signal available.";
}

// ── Cache badge ───────────────────────────────────────────
function renderCacheBadge(cached) {
  const b = $("cache-badge");
  if (cached) {
    b.className = "cache-badge cache-hit";
    b.textContent = "⚡ Cached";
  } else {
    b.className = "cache-badge cache-miss";
    b.textContent = "New scan";
  }
}

// ── Main render ───────────────────────────────────────────
function renderResult(data) {
  lastScore = data.trust_score ?? 0;
  renderGauge(lastScore);
  renderClaimAnalysis(data.linguistic_triggers, data.misinformation_type);
  renderNetworkMetrics(data.risk_vectors);
  renderCounterSignal(data.counter_signal);
  renderCacheBadge(data._cached);

  // Hide all secondary sections when new result loads
  ["spread-section","counter-narrative-section","provenance-section"].forEach(id => {
    $(id).style.display = "none";
  });

  showResult();
}

// ── Helpers: mini section toggle ──────────────────────────
function showSection(sectionId, loadingId, contentId) {
  const sec = $(sectionId);
  sec.style.display = "block";
  $(loadingId).style.display = "flex";
  $(contentId).style.display = "none";
  sec.scrollIntoView({ behavior: "smooth", block: "start" });
}
function revealContent(loadingId, contentId) {
  $(loadingId).style.display = "none";
  $(contentId).style.display = "block";
}

// ── Spread simulation ──────────────────────────────────────
$("spread-btn").addEventListener("click", async () => {
  if (!lastText) return;
  showSection("spread-section", "spread-loading", "spread-content");

  try {
    const res = await fetch("http://127.0.0.1:8000/simulate-spread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lastText, trust_score: lastScore, virality: lastVirality }),
    });
    const data = await res.json();

    $("spread-peak").textContent   = data.peak_reach ? data.peak_reach.toLocaleString() : "—";
    $("spread-window").textContent = data.containment_window || "—";

    // Timeline
    const tl = $("spread-timeline");
    tl.innerHTML = "";
    (data.phases || []).forEach((p, i, arr) => {
      const item = document.createElement("div");
      item.className = "tl-item";
      const dotClass = i === 0 ? "green" : i === arr.length - 1 ? "" : "yellow";
      item.innerHTML = `
        <div class="tl-dot ${dotClass}"></div>
        <div class="tl-platform">${p.label}<span class="tl-time">${p.time || ""}</span></div>
        <div class="tl-note">${p.note || ""}</div>
        ${p.reach ? `<div class="tl-reach">${p.reach.toLocaleString()} reach</div>` : ""}
      `;
      tl.appendChild(item);
    });

    // Super spreaders
    const chips = $("spreader-chips");
    chips.innerHTML = "";
    (data.super_spreaders || []).forEach(s => {
      const c = document.createElement("span");
      c.className = "spreader-chip";
      c.textContent = s;
      chips.appendChild(c);
    });

    revealContent("spread-loading", "spread-content");
  } catch (e) {
    $("spread-loading").innerHTML = `<span style="color:var(--muted);font-size:12px;">Error: ${e.message}</span>`;
  }
});

// ── Counter Narrative ──────────────────────────────────────
$("counter-narrative-btn").addEventListener("click", async () => {
  if (!lastText) return;
  showSection("counter-narrative-section", "cn-loading", "cn-content");

  try {
    const res  = await fetch("http://127.0.0.1:8000/counter-narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lastText }),
    });
    const data = await res.json();

    $("cn-reply").textContent    = data.reply_template    || "—";
    $("cn-extended").textContent = data.extended_rebuttal || "—";

    const srcList = $("cn-sources");
    srcList.innerHTML = "";
    (data.suggested_sources || []).forEach(s => {
      const row = document.createElement("div");
      row.className = "source-item";
      row.innerHTML = `<i class="ti ti-link" aria-hidden="true"></i><a href="${s.url}" target="_blank" rel="noopener">${s.name} ↗</a>`;
      srcList.appendChild(row);
    });

    const hRow = $("cn-hashtags");
    hRow.innerHTML = "";
    (data.hashtags || []).forEach(h => {
      const tag = document.createElement("span");
      tag.className = "hashtag";
      tag.textContent = h;
      hRow.appendChild(tag);
    });

    revealContent("cn-loading", "cn-content");
  } catch (e) {
    $("cn-loading").innerHTML = `<span style="color:var(--muted);font-size:12px;">Error: ${e.message}</span>`;
  }
});

// Copy reply template
$("copy-reply-btn").addEventListener("click", async () => {
  const text = $("cn-reply").textContent;
  await navigator.clipboard.writeText(text).catch(() => {});
  $("copy-reply-btn").classList.add("copied");
  $("copy-reply-btn").innerHTML = `<i class="ti ti-check" aria-hidden="true"></i>Copied!`;
  setTimeout(() => {
    $("copy-reply-btn").classList.remove("copied");
    $("copy-reply-btn").innerHTML = `<i class="ti ti-copy" aria-hidden="true"></i>Copy Reply Template`;
  }, 2200);
});

// ── Provenance ─────────────────────────────────────────────
$("provenance-btn").addEventListener("click", async () => {
  if (!lastText) return;
  showSection("provenance-section", "prov-loading", "prov-content");

  try {
    const res  = await fetch("http://127.0.0.1:8000/provenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lastText }),
    });
    const data = await res.json();

    $("prov-origin").textContent = data.origin_platform || "Unknown";

    const conf = $("prov-conf");
    conf.style.cssText = confidenceStyle(data.confidence) + "border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:4px;margin-bottom:12px;";
    conf.innerHTML = `<i class="ti ti-radar" style="font-size:12px;" aria-hidden="true"></i>Confidence: ${data.confidence || "—"}`;

    const tl = $("prov-timeline");
    tl.innerHTML = "";
    (data.chain || []).forEach((item, i, arr) => {
      const d = document.createElement("div");
      d.className = "tl-item";
      const dotClass = i === 0 ? "green" : i === arr.length - 1 ? "" : "yellow";
      d.innerHTML = `
        <div class="tl-dot ${dotClass}"></div>
        <div class="tl-platform">${item.platform}<span class="tl-time"> · ${item.time_ago}</span></div>
        <div class="tl-note">${item.event}</div>
      `;
      tl.appendChild(d);
    });

    $("prov-note").textContent = data.note || "";
    revealContent("prov-loading", "prov-content");
  } catch (e) {
    $("prov-loading").innerHTML = `<span style="color:var(--muted);font-size:12px;">Error: ${e.message}</span>`;
  }
});

// ── Copy counter-signal ────────────────────────────────────
$("copy-btn").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("counter-text").textContent).catch(() => {});
  $("copy-btn").classList.add("copied");
  $("copy-icon").className = "ti ti-check";
  $("copy-label").textContent = "Copied!";
  setTimeout(() => {
    $("copy-btn").classList.remove("copied");
    $("copy-icon").className = "ti ti-copy";
    $("copy-label").textContent = "Copy Counter-Signal";
  }, 2200);
});

// ── Retry ──────────────────────────────────────────────────
$("retry-btn").addEventListener("click", () => {
  if (lastText) runVerification(lastText);
  else show(idle);
});

// ── Verification ───────────────────────────────────────────
async function runVerification(text) {
  show(loading);
  $("query-pill").style.display = "flex";
  $("query-text").textContent   = text.length > 180 ? text.slice(0, 177) + "…" : text;

  try {
    const res = await fetch("http://127.0.0.1:8000/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    renderResult(await res.json());
  } catch (err) {
    $("error-msg").textContent = `Backend unreachable.\n\n${err.message}\n\nMake sure FastAPI is running on http://127.0.0.1:8000`;
    show(errorEl);
  }
}

// ── Poll ───────────────────────────────────────────────────
async function checkPending() {
  const data    = await chrome.storage.session.get("pendingVerification");
  const pending = data?.pendingVerification;
  if (!pending) return;
  const isNew   = Date.now() - pending.timestamp < 5000;
  const changed = pending.text !== lastText;
  if (isNew && changed) {
    lastText = pending.text;
    await chrome.storage.session.remove("pendingVerification");
    runVerification(pending.text);
  }
}

// ── Init ───────────────────────────────────────────────────
show(idle);
checkPending();
setInterval(checkPending, 500);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.pendingVerification) checkPending();
});