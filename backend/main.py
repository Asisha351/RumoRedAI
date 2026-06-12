from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextPayload(BaseModel):
    text: str

@app.post("/verify")
def verify_text(payload: TextPayload):
    system_prompt = (
        "Analyze the text provided. Return ONLY a valid JSON object with no markdown, "
        "no backticks, and no extra text. Use this exact structure:\n"
        "{\n"
        '  "trust_score": <integer 0-100>,\n'
        '  "linguistic_triggers": [<list of short strings, each a specific manipulation tactic found>],\n'
        '  "misinformation_type": "<one of: Sensationalist / Clickbait Framing | Out-of-Context Fabrication | '
        'Emotional Manipulation | Conspiracy / Suppression Theory | Mixed Linguistic Manipulation | Factual Content>",\n'
        '  "risk_vectors": {\n'
        '    "virality": "<High | Medium | Low>",\n'
        '    "trajectory": "<1-sentence description of how this claim might spread online>"\n'
        "  },\n"
        '  "counter_signal": "<A neutral, factual 1-2 sentence rebuttal or clarification>"\n'
        "}"
    )

    ollama_response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "mistral",
            "prompt": f"System Guidelines: {system_prompt}\n\nAnalyze this text: {payload.text}",
            "stream": False
        }
    )

    raw_ai_text = ollama_response.json().get("response", "").strip()

    # Strip accidental markdown fences if Mistral adds them
    if raw_ai_text.startswith("```"):
        raw_ai_text = raw_ai_text.split("```")[1]
        if raw_ai_text.startswith("json"):
            raw_ai_text = raw_ai_text[4:]
    raw_ai_text = raw_ai_text.strip()

    try:
        return json.loads(raw_ai_text)
    except Exception:
        return {
            "trust_score": 50,
            "linguistic_triggers": ["Parsing Error — model returned malformed JSON"],
            "misinformation_type": "Unclassified",
            "risk_vectors": {
                "virality": "Unknown",
                "trajectory": "Unable to assess propagation risk due to a processing error."
            },
            "counter_signal": "Unable to generate a counter-signal. Please retry."
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)