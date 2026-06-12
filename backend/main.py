import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json, random

from database.cache import init_db, cache_get, cache_set
from services.ollama_client import call_ollama
from services.hasher import make_hash

app = FastAPI(
    title="RumoRED API",
    description="Local AI-powered misinformation detection backend.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

# ── Models ─────────────────────────────────────────────────
class TextPayload(BaseModel):
    text: str

class SpreadPayload(BaseModel):
    text: str
    trust_score: int
    virality: str

# ── Prompts ────────────────────────────────────────────────
VERIFY_PROMPT = """Analyze the text provided. Return ONLY a valid JSON object with no markdown, \
no backticks, and no extra text. Use this exact structure:
{
  "trust_score": <integer 0-100>,
  "linguistic_triggers": [<list of short strings, each a specific manipulation tactic found>],
  "misinformation_type": "<one of: Sensationalist / Clickbait Framing | Out-of-Context Fabrication | \
Emotional Manipulation | Conspiracy / Suppression Theory | Mixed Linguistic Manipulation | Factual Content>",
  "risk_vectors": {
    "virality": "<High | Medium | Low>",
    "trajectory": "<1-sentence description of how this claim might spread online>"
  },
  "counter_signal": "<A neutral, factual 1-2 sentence rebuttal or clarification>"
}"""

SPREAD_PROMPT = """Return ONLY a raw JSON object. No explanation, no markdown, no intro text, no backticks.
Use exactly this structure and fill in real values:
{"phases":[{"label":"Origin post","time":"0h","reach":500,"note":"Initial publish."},{"label":"Early sharers","time":"1h","reach":3000,"note":"Niche accounts share."},{"label":"Mid-tier amplifiers","time":"3h","reach":25000,"note":"10k-100k follower accounts retweet."},{"label":"Cross-platform bleed","time":"6h","reach":120000,"note":"Spreads to Reddit and Facebook."},{"label":"Mainstream pickup","time":"12h","reach":800000,"note":"News aggregators cite it."}],"super_spreaders":["Political commentators","Anonymous amplifier bots","Conspiracy influencers"],"peak_reach":1200000,"containment_window":"6-12 hours"}
Now generate a new version of this JSON based on the virality level provided. Only output the JSON object."""

COUNTER_PROMPT = """Return ONLY a raw JSON object. No explanation, no markdown, no intro text, no backticks.
Use exactly this structure:
{"reply_template":"<short tweet-style reply under 280 chars>","extended_rebuttal":"<2-3 sentence rebuttal>","suggested_sources":[{"name":"Reuters Fact Check","url":"https://www.reuters.com/fact-check"},{"name":"Snopes","url":"https://www.snopes.com"},{"name":"AP Fact Check","url":"https://apnews.com/hub/ap-fact-check"}],"hashtags":["#FactCheck","#Misinformation","#VerifyBeforeYouShare"]}
Now generate a new version of this JSON as a counter-narrative for the flagged text provided. Only output the JSON object."""

PROV_PROMPT = """Return ONLY a raw JSON object. No explanation, no markdown, no intro text, no backticks.
Use exactly this structure:
{"origin_platform":"Reddit","chain":[{"platform":"Reddit","time_ago":"8h ago","event":"Original post in niche subreddit."},{"platform":"X (Twitter)","time_ago":"5h ago","event":"Screenshot shared by anonymous account."},{"platform":"Facebook Groups","time_ago":"3h ago","event":"Shared in closed political groups."},{"platform":"WhatsApp","time_ago":"1h ago","event":"Forwarded in private chains."}],"confidence":"Medium","note":"This is a simulated provenance estimate based on typical spread patterns."}
Now generate a new version of this JSON for the text provided. Only output the JSON object."""

# ── /verify ────────────────────────────────────────────────
@app.post("/verify")
def verify_text(payload: TextPayload):
    h = make_hash(payload.text)
    cached = cache_get(h)
    if cached:
        cached["_cached"] = True
        return cached

    raw = call_ollama(f"{VERIFY_PROMPT}\n\nAnalyze this text: {payload.text}")
    try:
        data = json.loads(raw)
    except Exception:
        data = {
            "trust_score": 50,
            "linguistic_triggers": ["Parsing Error — model returned malformed JSON"],
            "misinformation_type": "Unclassified",
            "risk_vectors": {"virality": "Unknown", "trajectory": "Unable to assess."},
            "counter_signal": "Unable to generate a counter-signal. Please retry.",
        }

    data["_cached"] = False
    cache_set(h, data)
    return data

# ── /simulate-spread ───────────────────────────────────────
@app.post("/simulate-spread")
def simulate_spread(payload: SpreadPayload):
    h = make_hash("spread:" + payload.text)
    cached = cache_get(h)
    if cached:
        return cached

    prompt = f"{SPREAD_PROMPT}\n\nText: {payload.text}\nVirality level: {payload.virality}\nTrust score: {payload.trust_score}"
    raw = call_ollama(prompt)
    try:
        data = json.loads(raw)
    except Exception:
        v    = payload.virality.lower()
        mult = 10 if v == "high" else 3 if v == "medium" else 1
        data = {
            "phases": [
                {"label": "Origin post",           "time": "0h",  "reach": random.randint(50, 200)    * mult, "note": "Initial publish on source platform."},
                {"label": "Early sharers",         "time": "1h",  "reach": random.randint(500, 2000)  * mult, "note": "Picked up by niche community accounts."},
                {"label": "Mid-tier amplifiers",   "time": "3h",  "reach": random.randint(5000, 20000)* mult, "note": "Retweeted by accounts with 10k-100k followers."},
                {"label": "Cross-platform bleed",  "time": "6h",  "reach": random.randint(50000, 200000)*mult, "note": "Migrates to Reddit, Facebook, WhatsApp groups."},
                {"label": "Mainstream pickup",     "time": "12h", "reach": random.randint(200000, 1000000)*mult, "note": "Cited by news aggregators or influencers."},
            ],
            "super_spreaders": ["Political commentators", "Conspiracy-adjacent influencers", "Anonymous amplifier bots"],
            "peak_reach": random.randint(500000, 5000000) * mult,
            "containment_window": "6-12 hours" if v == "high" else "24-48 hours",
        }

    cache_set(h, data)
    return data

# ── /counter-narrative ─────────────────────────────────────
@app.post("/counter-narrative")
def counter_narrative(payload: TextPayload):
    h = make_hash("counter:" + payload.text)
    cached = cache_get(h)
    if cached:
        return cached

    raw = call_ollama(f"{COUNTER_PROMPT}\n\nFlagged text: {payload.text}")
    try:
        data = json.loads(raw)
    except Exception:
        data = {
            "reply_template": "This claim lacks verified sources. Always cross-check with trusted outlets before sharing.",
            "extended_rebuttal": "The statement contains linguistic patterns common in misinformation. No credible primary sources support this claim.",
            "suggested_sources": [
                {"name": "Reuters Fact Check", "url": "https://www.reuters.com/fact-check"},
                {"name": "Snopes",             "url": "https://www.snopes.com"},
                {"name": "AP Fact Check",      "url": "https://apnews.com/hub/ap-fact-check"},
            ],
            "hashtags": ["#FactCheck", "#Misinformation", "#VerifyBeforeYouShare"],
        }

    cache_set(h, data)
    return data

# ── /provenance ────────────────────────────────────────────
@app.post("/provenance")
def get_provenance(payload: TextPayload):
    h = make_hash("prov:" + payload.text)
    cached = cache_get(h)
    if cached:
        return cached

    raw = call_ollama(f"{PROV_PROMPT}\n\nText: {payload.text}")
    try:
        data = json.loads(raw)
    except Exception:
        data = {
            "origin_platform": "Reddit / Fringe Forums",
            "chain": [
                {"platform": "Reddit",          "time_ago": "8h ago", "event": "Original post in niche subreddit, ~200 upvotes."},
                {"platform": "X (Twitter)",     "time_ago": "5h ago", "event": "Screenshot shared by anonymous account, 1.2K retweets."},
                {"platform": "Facebook Groups", "time_ago": "3h ago", "event": "Shared in 3 closed political groups, ~8K members combined."},
                {"platform": "WhatsApp",        "time_ago": "1h ago", "event": "Forwarded in private chains, reach untrackable."},
            ],
            "confidence": "Medium",
            "note": "This is a simulated provenance estimate based on typical spread patterns for this claim type.",
        }

    cache_set(h, data)
    return data

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)