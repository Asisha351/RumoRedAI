import re
import requests
from config import OLLAMA_URL, MODEL, TIMEOUT


def strip_fences(text: str) -> str:
    """Remove accidental markdown code fences from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


def extract_json(text: str) -> str:
    """
    Try to pull the first { ... } block out of messy LLM output.
    Handles cases where the model adds intro/outro sentences around the JSON.
    """
    text = strip_fences(text)
    # Already clean JSON
    if text.startswith("{"):
        return text
    # Find the first { and last } and slice between them
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text   # return as-is and let json.loads fail naturally


def call_ollama(prompt: str, retries: int = 3) -> str:
    """
    Send a prompt to Ollama. Retries up to `retries` times if the
    response isn't valid-looking JSON (starts with '{').
    """
    last_response = ""
    for attempt in range(retries):
        try:
            response = requests.post(
                OLLAMA_URL,
                json={
                    "model":   MODEL,
                    "prompt":  prompt,
                    "stream":  False,
                    "options": {"temperature": 0},
                },
                timeout=TIMEOUT,
            )
            response.raise_for_status()
            raw = response.json().get("response", "").strip()
            cleaned = extract_json(raw)
            last_response = cleaned

            # If it looks like JSON, return it immediately
            if cleaned.startswith("{"):
                return cleaned

        except requests.exceptions.RequestException as e:
            last_response = f'{{"error": "Ollama connection failed: {e}"}}'

    # Return whatever we got after all retries
    return last_response