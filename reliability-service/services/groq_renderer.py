import json
import logging
import os
from typing import Any

import requests
from models.insight import Insight

logger = logging.getLogger(__name__)

GROQ_API_BASE_URL = os.getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1/responses")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
GROQ_TIMEOUT_SECONDS = int(os.getenv("GROQ_TIMEOUT_SECONDS", "12"))


def _build_prompt(insight: Insight) -> str:
    return (
        "Write an emotionally intelligent, human-readable status summary for a monitor. "
        "Use the monitor insight data below and make it sound empathetic, concise, and actionable. "
        "Avoid technical jargon and keep it focused on reliability, impact, and next steps.\n\n"
        f"Monitor ID: {insight.monitor_id}\n"
        f"Risk score: {insight.risk_score}\n"
        f"Severity: {insight.severity}\n"
        f"Anomaly detected: {'yes' if insight.anomaly_detected else 'no'}\n"
        f"Summary: {insight.summary}\n"
        f"Recommended action: {insight.recommended_action}\n\n"
        "Return a single short paragraph that a product owner or site operator can read and understand instantly."
    )


def _extract_text(response_json: dict[str, Any]) -> str:
    if not response_json:
        return ""

    if "output_text" in response_json and isinstance(response_json["output_text"], str):
        return response_json["output_text"]

    if "output" in response_json and isinstance(response_json["output"], list):
        parts = []
        for item in response_json["output"]:
            if isinstance(item, dict):
                if "content" in item and isinstance(item["content"], str):
                    parts.append(item["content"])
                elif "text" in item and isinstance(item["text"], str):
                    parts.append(item["text"])
        if parts:
            return "".join(parts)

    if "choices" in response_json and isinstance(response_json["choices"], list):
        for choice in response_json["choices"]:
            if isinstance(choice, dict):
                if "message" in choice and isinstance(choice["message"], dict):
                    content = choice["message"].get("content")
                    if isinstance(content, str):
                        return content
                if "text" in choice and isinstance(choice["text"], str):
                    return choice["text"]
    return ""


def render_insight_narrative(insight: Insight) -> str:
    if not GROQ_API_KEY:
        raise EnvironmentError("GROQ_API_KEY is not configured")

    prompt = _build_prompt(insight)
    payload = {
        "model": GROQ_MODEL,
        "input": prompt,
        "max_output_tokens": 200,
    }
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            GROQ_API_BASE_URL,
            headers=headers,
            json=payload,
            timeout=GROQ_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        result = response.json()
        text = _extract_text(result).strip()
        if not text:
            raise ValueError("Groq response did not contain readable text")
        return text
    except Exception as exc:
        logger.error("Groq narrative generation failed: %s", exc)
        raise
