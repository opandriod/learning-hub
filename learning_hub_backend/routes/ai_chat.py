import os
from pathlib import Path
import requests
from flask import Blueprint, jsonify, request
from dotenv import load_dotenv
from middleware.auth_middleware import jwt_required

load_dotenv()

ai_chat_bp = Blueprint("ai_chat", __name__)

# =========================
# GEMINI CONFIG
# =========================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"

# If one model is unavailable for the user's key/account, try the next one.
FALLBACK_MODELS = [
    GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite-preview",
]



# =========================
# LEARNING HUB KNOWLEDGE BASE
# =========================
def _load_learning_hub_guide():
    """Load platform-specific rules so the AI does not guess Learning Hub policies."""
    try:
        guide_path = Path(__file__).resolve().parents[1] / "ai_knowledge_base.txt"
        return guide_path.read_text(encoding="utf-8").strip()
    except Exception as exc:
        print("AI GUIDE LOAD WARNING:", exc)
        return ""


LEARNING_HUB_GUIDE = _load_learning_hub_guide()

# =========================
# SYSTEM INSTRUCTION
# =========================
SYSTEM_INSTRUCTION = f"""
You are the official Learning Hub AI Assistant for Only Learning Hub.

Use the Learning Hub knowledge base below as your source of truth for platform rules.
Do not invent policies, payment split percentages, role approval rules, or database behavior.
If the answer is not in the guide, say that the user should contact the admin/instructor/support.
You may also explain BCA academic topics in simple English when users ask study questions.

{LEARNING_HUB_GUIDE}
""".strip()


# =========================
# HELPERS
# =========================
def _unique_models(models):
    seen = set()
    unique = []
    for model in models:
        model = str(model or "").strip()
        if model and model not in seen:
            seen.add(model)
            unique.append(model)
    return unique


def _clean_history(history):
    """Keep only a small safe text history to reduce token usage."""
    cleaned = []

    if not isinstance(history, list):
        return cleaned

    for item in history[-8:]:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = str(item.get("content", "")).strip()

        if role not in {"user", "assistant"}:
            continue

        if not content:
            continue

        cleaned.append({
            "role": role,
            "content": content[:1200],
        })

    return cleaned


def _build_prompt(current_user, message, history):
    role = current_user.get("role", "user") if isinstance(current_user, dict) else "user"
    semester_id = current_user.get("semester_id") if isinstance(current_user, dict) else None

    user_context = (
        f"Current user role: {role}. "
        f"Student semester id: {semester_id or 'not set'}."
    )

    conversation_text = ""
    for item in history:
        speaker = "Student" if item["role"] == "user" else "Assistant"
        conversation_text += f"{speaker}: {item['content']}\n"

    return f"""
{SYSTEM_INSTRUCTION}

{user_context}

Recent conversation:
{conversation_text}

Student question:
{message}
""".strip()


def _is_model_not_found(response):
    if response.status_code != 404:
        return False

    try:
        detail = response.json()
    except Exception:
        detail = {"raw": response.text}

    text = str(detail).lower()
    return "model" in text and ("not found" in text or "not supported" in text)


def _call_gemini(model_name, prompt):
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.35,
            "topP": 0.9,
            "maxOutputTokens": 700,
        },
    }

    return requests.post(
        endpoint,
        params={"key": GEMINI_API_KEY},
        json=payload,
        timeout=30,
    )


def _extract_answer(result):
    candidates = result.get("candidates", [])

    if not candidates:
        return ""

    content = candidates[0].get("content", {})
    parts = content.get("parts", [])

    return "".join(part.get("text", "") for part in parts).strip()


# =========================
# ROUTE
# Final URL: /api/ai/chat
# app.py should register:
# app.register_blueprint(ai_chat_bp, url_prefix="/api/ai")
# =========================
@ai_chat_bp.route("/chat", methods=["POST"])
@jwt_required
def chat_with_ai(current_user):
    try:
        if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
            return jsonify({
                "error": "Gemini API key is missing. Add GEMINI_API_KEY in backend .env file."
            }), 500

        data = request.get_json(silent=True) or {}
        message = str(data.get("message", "")).strip()
        history = _clean_history(data.get("history", []))

        if not message:
            return jsonify({"error": "Message is required."}), 400

        if len(message) > 2000:
            return jsonify({
                "error": "Message is too long. Please keep it under 2000 characters."
            }), 400

        prompt = _build_prompt(current_user, message, history)
        last_error = None

        for model_name in _unique_models(FALLBACK_MODELS):
            response = _call_gemini(model_name, prompt)

            if response.status_code == 200:
                result = response.json()
                answer = _extract_answer(result)

                if not answer:
                    answer = "Sorry, I could not generate an answer. Please try again."

                return jsonify({
                    "reply": answer,
                    "model": model_name,
                }), 200

            try:
                last_error = response.json()
            except Exception:
                last_error = response.text

            print(f"GEMINI API ERROR using model {model_name}:", last_error)

            # API key/quota/billing errors will not be fixed by trying another model.
            # Only continue when the model itself is unavailable.
            if not _is_model_not_found(response):
                break

        print("FINAL GEMINI API ERROR:", last_error)
        return jsonify({
            "error": "AI assistant is unavailable right now. Check Gemini API key, model, quota, or internet connection."
        }), 502

    except requests.Timeout:
        return jsonify({"error": "AI request timed out. Please try again."}), 504

    except requests.RequestException as e:
        print("AI NETWORK ERROR:", e)
        return jsonify({"error": "AI network error. Check internet connection on the backend."}), 502

    except Exception as e:
        print("AI CHAT ERROR:", e)
        return jsonify({
            "error": "AI assistant server error.",
            "details": str(e),
        }), 500
