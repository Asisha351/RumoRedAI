// ── DOM refs ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const idle    = $("idle-state");
const loading = $("loading-state");
const error   = $("error-state");
const result  = $("result-state");

// ── State ─────────────────────────────────────────────────
let lastText = null;

// ── Show / hide helpers ───────────────────────────────────
const states = [idle, loading, error, result];
function show(el) {
  states.forEach(s => s.style.display = "none");
  el.style.display = "flex";
}
// result-state is a block element
function showResult() {
  states.forEach(s => s.style.display = "none");
  result.style.display = "block";
}

// ── Poll storage for a new verification request ───────────
async function checkPending() {
  const data = await chrome.storage.session.get("pendingVerification");
  const pending = data?.pendingVerification;
  if (!pending) return;

  // Only act if it's fresh (within 5 seconds) and different
  const isNew   = Date.now() - pending.timestamp < 5000;
  const changed = pending.text !== lastText;

  if (isNew && changed) {
    lastText = pending.text;
    // Clear so we don't re-trigger
    await chrome.storage.session.remove("pendingVerification");
    runVerification(pending.text);
  }
}

// ── Main verification flow ────────────────────────────────
async function runVerification(text) {
  show(loading);

  // Show query pill
  $("query-pill").style.display  = "flex";
  $("query-text").textContent    = text.length > 200 ? text.slice(0, 197) + "…" : text;

  try {
    const res = await fetch("http://127.0.0.1:8000/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`Server responded with ${res.status}`);

    const json = await res.json();
    renderResult(json);
  } catch (err) {
    $("error-msg").textContent =
      `Could not reach the RumoRED backend.\n\n${err.message}\n\nMake sure it is running on http://127.0.0.1:8000`;
    show(error);
  }
}

// ── Render helpers ────────────────────────────────────────
function scoreColor(score) {
  if (score >= 70) return "#4caf82";   // green
  if (score >= 40) return "#f5c842";   // yellow
  return "#e03c3c";                    // red
}

function scoreVerdict(score) {
  if (score >= 70) return { label: "Likely Credible", color: "#4caf82" };
  if (score >= 40) return { label: "Uncertain",       color: "#f5c842" };
  return             { label: "High Risk",           color: "#e03c3c" };
}

function riskColor(val) {
  if (val >= 70) return "#e03c3c";
  if (val >= 40) return "#f5c842";
  return "#4caf82";
}

function renderGauge(score) {
  const clamped  = Math.max(0, Math.min(100, score));
  const arcLen   = 175.9;                          // full half-circle dash length
  const offset   = arcLen - (clamped / 100) * arcLen;
  const fill     = $("gauge-fill");
  const color    = scoreColor(clamped);
  const verdict  = scoreVerdict(clamped);

  // Kick animation on next frame
  requestAnimationFrame(() => {
    fill.style.strokeDashoffset = offset;
    fill.style.stroke           = color;
  });

  $("gauge-score").textContent    = clamped;
  $("gauge-score").style.color    = color;
  $("gauge-verdict").textContent  = verdict.label;
  $("gauge-verdict").style.color  = verdict.color;
}

function renderTriggers(triggers) {
  const list = $("trigger-list");
  list.innerHTML = "";
  if (!triggers?.length) {
    list.innerHTML = `<span style="color:var(--muted);font-size:12px;">None detected</span>`;
    return;
  }
  triggers.forEach(t => {
    const tag = document.createElement("span");
    tag.className   = "trigger-tag";
    tag.textContent = t;
    list.appendChild(tag);
  });
}

// Maps your backend's string values to numeric bar widths
const VIRALITY_MAP = { high: 90, medium: 50, low: 20 };

function renderRiskVectors(vectors) {
  const container = $("risk-vectors");
  container.innerHTML = "";
  if (!vectors || !Object.keys(vectors).length) {
    container.innerHTML = `<span style="color:var(--muted);font-size:12px;">No data</span>`;
    return;
  }

  Object.entries(vectors).forEach(([key, rawVal]) => {
    const isNumeric = typeof rawVal === "number";
    const isString  = typeof rawVal === "string";

    if (isNumeric) {
      // Numeric path: render a bar (0–100 or 0.0–1.0)
      const val = rawVal > 1 ? Math.round(rawVal) : Math.round(rawVal * 100);
      const clr = riskColor(val);
      const row = document.createElement("div");
      row.className = "risk-row";
      row.innerHTML = `
        <div class="risk-label">${key}</div>
        <div class="risk-bar-bg">
          <div class="risk-bar-fill" style="width:0%;background:${clr}"></div>
        </div>
        <div class="risk-value" style="color:${clr}">${val}</div>
      `;
      container.appendChild(row);
      requestAnimationFrame(() => {
        row.querySelector(".risk-bar-fill").style.width = `${val}%`;
      });

    } else if (isString) {
      const lower = rawVal.toLowerCase();

      // If it maps to a known level (High/Medium/Low) → show bar + badge
      if (lower in VIRALITY_MAP) {
        const val = VIRALITY_MAP[lower];
        const clr = riskColor(val);
        const row = document.createElement("div");
        row.className = "risk-row";
        row.innerHTML = `
          <div class="risk-label">${key}</div>
          <div class="risk-bar-bg">
            <div class="risk-bar-fill" style="width:0%;background:${clr}"></div>
          </div>
          <div class="risk-value" style="color:${clr}">${rawVal}</div>
        `;
        container.appendChild(row);
        requestAnimationFrame(() => {
          row.querySelector(".risk-bar-fill").style.width = `${val}%`;
        });

      } else {
        // Long string (e.g. trajectory sentence) → render as text block
        const block = document.createElement("div");
        block.style.cssText = "margin-bottom:8px;";
        block.innerHTML = `
          <div style="font-size:10px;color:var(--muted);text-transform:capitalize;
                      letter-spacing:.6px;margin-bottom:4px;">${key}</div>
          <div style="font-size:12px;color:var(--text);line-height:1.5;">${rawVal}</div>
        `;
        container.appendChild(block);
      }
    }
  });
}

function renderCounterSignal(text) {
  $("counter-text").textContent = text || "No counter-signal available.";
}

// ── Main render ───────────────────────────────────────────
function renderResult(data) {
  const { trust_score, linguistic_triggers, risk_vectors, counter_signal } = data;

  renderGauge(trust_score ?? 0);
  renderTriggers(linguistic_triggers);
  renderRiskVectors(risk_vectors);
  renderCounterSignal(counter_signal);
  showResult();
}

// ── Copy button ───────────────────────────────────────────
$("copy-btn").addEventListener("click", async () => {
  const text = $("counter-text").textContent;
  try {
    await navigator.clipboard.writeText(text);
    const btn   = $("copy-btn");
    const icon  = $("copy-icon");
    const label = $("copy-label");
    btn.classList.add("copied");
    icon.textContent  = "✅";
    label.textContent = "Copied!";
    setTimeout(() => {
      btn.classList.remove("copied");
      icon.textContent  = "📋";
      label.textContent = "Copy Counter-Signal";
    }, 2200);
  } catch {
    alert("Clipboard access denied. Please copy manually.");
  }
});

// ── Retry button ──────────────────────────────────────────
$("retry-btn").addEventListener("click", () => {
  if (lastText) runVerification(lastText);
  else show(idle);
});

// ── Init ──────────────────────────────────────────────────
show(idle);

// Poll immediately and then every 500 ms for a new request
checkPending();
setInterval(checkPending, 500);

// Also react to storage changes in real-time
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.pendingVerification) checkPending();
});