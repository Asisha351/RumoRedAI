from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import json

app = FastAPI()

# Enable CORS so your Browser Extension can talk to localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows your chrome extension to connect
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextPayload(BaseModel):
    text: str

@app.post("/verify")
def verify_text(payload: TextPayload):
    # System Prompt forcing Ollama to return the exact JSON format your side-panel needs
    system_prompt = (
        "Analyze the text provided. Return ONLY a valid JSON object. Do not include markdown formatting, "
        "do not include backticks (```json), and do not include conversational intro/outro text. "
        "The JSON must strictly follow this structure:\n"
        "{\n"
        '  "trust_score": <int between 0 and 100>,\n'
        '  "linguistic_triggers": [<list of strings highlighting manipulation style>],\n'
        '  "risk_vectors": {\n'
        '    "virality": "<High/Medium/Low>",\n'
        '    "trajectory": "<1-sentence description of narrative propagation risk>"\n'
        "  },\n"
        '  "counter_signal": "<A neutral, objective 1-sentence counter-statement>"\n'
        "}"
    )

    # Call your local Ollama instance directly
    ollama_response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "mistral", 
            "prompt": f"System Guidelines: {system_prompt}\n\nAnalyze this text: {payload.text}",
            "stream": False
        }
    )
    
    # Parse the text result out of Ollama's response
    raw_ai_text = ollama_response.json().get("response", "").strip()
    
    # Safely convert the string into actual JSON to send cleanly to the extension
    try:
        return json.loads(raw_ai_text)
    except Exception:
        # Fallback if the LLM misformats the JSON text string
        return {
            "trust_score": 50,
            "linguistic_triggers": ["Parsing Error"],
            "risk_vectors": {"virality": "Unknown", "trajectory": "Error processing framework"},
            "counter_signal": "Unable to safely process linguistic traits."
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)