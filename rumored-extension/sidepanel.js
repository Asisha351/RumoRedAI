const $ = id => document.getElementById(id);
const idle    = $("idle-state");
const loading = $("loading-state");
const errorEl = $("error-state");
const result  = $("result-state");

let lastText = null;

// ── Virality → numeric map ─────────────────────────────────
const VIRALITY_MAP = { high: 92, medium: 52, low: 18 };

// ── State helpers ──────────────────────────────────────────
function show(el, flex = true) {
  [idle, loading, errorEl, result].forEach(s => s.style.display = "none");
  el.style.display = flex ? "flex" : "block";
}

// ── Score color/verdict ────────────────────────────────────
function scoreColor(s) {
  if (s >= 70) return "#3ecf8e";
  if (s >= 40) return "#f5c842";
  return "#e05050";
}

function scoreVerdict(s) {
  if (s >= 70) return { label: "Likely Credible",   icon: "ti-circle-check",   bg: "rgba(62,207,142,0.12)", border: "rgba(62,207,142,0.3)", col: "#3ecf8e" };
  if (s >= 40) return { label: "Uncertain",          icon: "ti-circle-dot",     bg: "rgba(245,200,66,0.12)", border: "rgba(245,200,66,0.3)", col: "#f5c842" };
  return              { label: "High Risk",           icon: "ti-circle-x",       bg: "rgba(224,80,80,0.12)", border: "rgba(224,80,80,0.3)", col: "#e05050" };
}

function riskBadgeClass(str) {
  const l = str.toLowerCase();
  if (l === "high")   return "sc-high";
  if (l === "medium") return "sc-med";
  return "sc-low";
}

// ── Gauge ──────────────────────────────────────────────────
function renderGauge(score) {
  const s      = Math.max(0, Math.min(100, score));
  const circ   = 326.7;
  const offset = circ - (s / 100) * circ;
  const clr    = scoreColor(s);
  const v      = scoreVerdict(s);
  const ring   = $("gauge-ring");

  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = offset;
    ring.style.stroke           = clr;
  });

  $("gauge-score").textContent    = s;
  $("gauge-score").style.color    = clr;

  const badge = $("gauge-verdict-badge");
  badge.style.background          = v.bg;
  badge.style.border              = `1px solid ${v.border}`;
  badge.style.color               = v.col;
  badge.querySelector("i").className = `ti ${v.icon}`;
  $("gauge-verdict-text").textContent = v.label;

  const desc = s >= 70
    ? "Linguistic patterns suggest this content is reliable."
    : s >= 40
    ? "Mixed signals detected. Verify with additional sources."
    : "Strong indicators of manipulative or false content.";
  $("gauge-meta").textContent = desc;

  const fill = $("cred-fill");
  fill.style.background = clr;
  requestAnimationFrame(() => { fill.style.width = `${s}%`; });
  $("cred-pct").textContent = `${s}%`;
}

// ── Claim Analysis ─────────────────────────────────────────
function renderClaimAnalysis(triggers) {
  // Derive a "misinformation type" label from triggers
  const all = (triggers || []).join(" ").toLowerCase();
  let mistype = "Unclassified Narrative";
  if (all.includes("sensational") || all.includes("clickbait") || all.includes("hyperbole"))
    mistype = "Sensationalist / Clickbait Framing";
  else if (all.includes("context") || all.includes("fabricat") || all.includes("out-of-context"))
    mistype = "Out-of-Context Fabrication";
  else if (all.includes("emotion") || all.includes("fear") || all.includes("anger"))
    mistype = "Emotional Manipulation";
  else if (all.includes("conspiracy") || all.includes("hidden") || all.includes("cover"))
    mistype = "Conspiracy / Suppression Theory";
  else if (triggers && triggers.length)
    mistype = "Mixed Linguistic Manipulation";

  $("mistype-text").textContent = mistype;

  const list = $("flags-list");
  list.innerHTML = "";
  if (!triggers?.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:12px;">No specific triggers detected.</div>`;
    return;
  }
  triggers.forEach(t => {
    const div = document.createElement("div");
    div.className = "flag-item";
    div.innerHTML = `<i class="ti ti-alert-circle" aria-hidden="true"></i><span>${t}</span>`;
    list.appendChild(div);
  });
}

// ── Network Trajectory ─────────────────────────────────────
function renderNetworkMetrics(vectors) {
  const grid = $("stat-grid");
  grid.innerHTML = "";

  // Virality from backend
  const viralRaw  = vectors?.virality  || "Unknown";
  const trajectory = vectors?.trajectory || "No trajectory data.";
  const viralNum  = VIRALITY_MAP[viralRaw.toLowerCase()] ?? 50;
  const viralClass = riskBadgeClass(viralRaw);

  // Simulated metrics
  const spreadRate = viralNum > 70 ? "Exponential" : viralNum > 40 ? "Linear" : "Contained";
  const nodeReach  = viralNum > 70 ? `${(Math.random() * 3 + 1.5).toFixed(1)}M` : viralNum > 40 ? `${Math.floor(Math.random() * 500 + 100)}K` : `${Math.floor(Math.random() * 30 + 5)}K`;
  const halfLife   = viralNum > 70 ? "< 6 hrs" : viralNum > 40 ? "12–24 hrs" : "> 48 hrs";

  const cells = [
    { label: "Virality rate",    value: viralRaw,    badge: viralClass },
    { label: "Spread pattern",   value: spreadRate,  badge: viralNum > 70 ? "sc-high" : viralNum > 40 ? "sc-med" : "sc-low" },
    { label: "Est. node reach",  value: nodeReach,   badge: null },
    { label: "Content half-life", value: halfLife,   badge: null },
  ];

  cells.forEach(c => {
    const cell = document.createElement("div");
    cell.className = "stat-cell";
    cell.innerHTML = `
      <div class="sc-label">${c.label}</div>
      <div class="sc-value">${c.value}</div>
      ${c.badge ? `<span class="sc-badge ${c.badge}">${c.value}</span>` : ""}
    `;
    grid.appendChild(cell);
  });

  // Quarantine status
  const qStatus = viralNum > 70
    ? "Active — Mitigation Script Injected"
    : viralNum > 40
    ? "Monitoring — Partial Containment"
    : "Clear — No Quarantine Required";
  $("quarantine-text").textContent = `Simulated Quarantine: ${qStatus}`;

  // Trajectory as tooltip-like sub-text below the grid
  let traj = document.getElementById("trajectory-note");
  if (!traj) {
    traj = document.createElement("div");
    traj.id = "trajectory-note";
    traj.style.cssText = "font-size:11px;color:var(--muted);line-height:1.6;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);";
    $("stat-grid").parentElement.insertBefore(traj, $("quarantine-text").parentElement);
  }
  traj.innerHTML = `<i class="ti ti-chart-line" style="font-size:13px;vertical-align:-2px;margin-right:5px;" aria-hidden="true"></i>${trajectory}`;
}

// ── Counter Signal ─────────────────────────────────────────
function renderCounterSignal(text) {
  $("counter-text").textContent = text || "No counter-signal available.";
}

// ── Main render ────────────────────────────────────────────
function renderResult(data) {
  const { trust_score, linguistic_triggers, risk_vectors, counter_signal } = data;
  renderGauge(trust_score ?? 0);
  renderClaimAnalysis(linguistic_triggers);
  renderNetworkMetrics(risk_vectors);
  renderCounterSignal(counter_signal);
  show(result, false);
  result.style.display = "flex";
}

// ── Copy button ────────────────────────────────────────────
$("copy-btn").addEventListener("click", async () => {
  const text = $("counter-text").textContent;
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("copy-btn");
    btn.classList.add("copied");
    $("copy-icon").className = "ti ti-check";
    $("copy-label").textContent = "Copied!";
    setTimeout(() => {
      btn.classList.remove("copied");
      $("copy-icon").className = "ti ti-copy";
      $("copy-label").textContent = "Copy Counter-Signal";
    }, 2200);
  } catch {
    alert("Clipboard access denied. Please copy manually.");
  }
});

// ── Retry button ───────────────────────────────────────────
$("retry-btn").addEventListener("click", () => {
  if (lastText) runVerification(lastText);
  else show(idle);
});

// ── Verification flow ──────────────────────────────────────
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
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const json = await res.json();
    renderResult(json);
  } catch (err) {
    $("error-msg").textContent =
      `Backend unreachable.\n\n${err.message}\n\nMake sure the FastAPI server is running on http://127.0.0.1:8000`;
    show(errorEl);
  }
}

// ── Poll for new requests ──────────────────────────────────
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