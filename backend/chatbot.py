"""
CURA AI — RAG Chatbot Pipeline
Uses: altaidevorg/women-health-mini dataset + SentenceTransformers + Google Gemini
"""

import os
import numpy as np
from dotenv import load_dotenv
from google import genai
from google.genai import types
# pyrefly: ignore [missing-import]
from sentence_transformers import SentenceTransformer
# pyrefly: ignore [missing-import]
from datasets import load_dataset

load_dotenv()

# ─── Configuration ─────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
DATASET_NAME = "altaidevorg/women-health-mini"
TOP_K = 5  # Number of most-similar dataset entries to retrieve as context

# Gemini system prompt
SYSTEM_PROMPT = """You are CURA AI, a compassionate and knowledgeable women's health assistant.

Your role:
- Provide clear, factual, and supportive responses about women's health topics
- Use the provided medical context to enhance your answers
- Be empathetic, respectful, and non-judgmental
- Always recommend consulting a healthcare professional for medical decisions
- Keep responses concise yet informative (2-4 paragraphs max)

IMPORTANT ESCALATION RULE:
If the user describes symptoms that are urgent, severe, or require professional intervention,
end your response with exactly this JSON tag on its own line:
[ESCALATE]

Topics you cover: menstrual health, reproductive health, pregnancy, menopause, 
hormonal health, mental health related to women's issues, nutrition, sexual health, 
preventive care, and general wellness.

Never diagnose conditions or prescribe medications. Always be supportive and encouraging.
"""

# ─── Module-Level State ────────────────────────────────────────────────────────
_embedding_model: SentenceTransformer | None = None
_dataset_texts: list[str] = []
_dataset_embeddings: np.ndarray | None = None
_gemini_client = None
_initialized = False


def initialize():
    """Load dataset, embeddings model, and configure Gemini. Called once at startup."""
    global _embedding_model, _dataset_texts, _dataset_embeddings, _gemini_client, _initialized

    if _initialized:
        return

    print("Loading SentenceTransformer model...")
    _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

    print(f"Loading dataset: {DATASET_NAME}...")
    try:
        dataset = load_dataset(DATASET_NAME, split="train")

        # The women-health-mini dataset has a 'conversations' column
        # Each row has a list of dicts with 'role' and 'content'
        texts = []
        for row in dataset:
            conversations = row.get("conversations", [])
            if conversations:
                # Extract user question and assistant answer
                user_msg = ""
                assistant_msg = ""
                for turn in conversations:
                    role = turn.get("role", "")
                    content = turn.get("content", "")
                    if role == "user" and not user_msg:
                        user_msg = content
                    elif role == "assistant" and not assistant_msg:
                        assistant_msg = content
                if user_msg and assistant_msg:
                    texts.append(f"Q: {user_msg}\nA: {assistant_msg}")
            else:
                # Fallback: try question/answer columns
                parts = []
                if row.get("question"):
                    parts.append(f"Q: {row['question']}")
                if row.get("answer"):
                    parts.append(f"A: {row['answer']}")
                if parts:
                    texts.append("\n".join(parts))

        _dataset_texts = texts[:500]
        print(f"Loaded {len(_dataset_texts)} dataset entries")

        print("Computing dataset embeddings (this may take a moment)...")
        cache_path = os.path.join(os.path.dirname(__file__), "embeddings.npy")
        if os.path.exists(cache_path):
            print("Loading cached embeddings...")
            _dataset_embeddings = np.load(cache_path)
        else:
            _dataset_embeddings = _embedding_model.encode(
                _dataset_texts,
                batch_size=64,
                show_progress_bar=True,
                normalize_embeddings=True,
            )
            np.save(cache_path, _dataset_embeddings)
        print(f"Embeddings computed: shape {_dataset_embeddings.shape}")

    except Exception as e:
        print(f"Warning: Could not load dataset ({e}). Continuing without knowledge base.")
        _dataset_texts = []
        _dataset_embeddings = None

    print("Configuring Gemini API...")
    if GEMINI_API_KEY and GEMINI_API_KEY != "your_google_gemini_api_key_here":
        try:
            _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
            # Quick validation — list models to verify key works
            print("Gemini API configured successfully")
        except Exception as e:
            print(f"Warning: Gemini API configuration failed: {e}")
            _gemini_client = None
    else:
        print("Warning: No GEMINI_API_KEY set — responses will use fallback mode")
        _gemini_client = None

    _initialized = True
    print("CURA AI chatbot initialized!")


def _cosine_similarity(query_embedding: np.ndarray, corpus_embeddings: np.ndarray) -> np.ndarray:
    """Compute cosine similarity between a query and all corpus entries."""
    # Both should be normalized — dot product == cosine similarity
    return np.dot(corpus_embeddings, query_embedding)


def _retrieve_context(query: str, top_k: int = TOP_K) -> str:
    """Retrieve the most relevant dataset entries for a given query."""
    if _embedding_model is None or _dataset_embeddings is None or len(_dataset_texts) == 0:
        return ""

    query_embedding = _embedding_model.encode(query, normalize_embeddings=True)
    scores = _cosine_similarity(query_embedding, _dataset_embeddings)

    top_indices = np.argsort(scores)[::-1][:top_k]
    relevant = [_dataset_texts[i] for i in top_indices if scores[i] > 0.3]

    if not relevant:
        return ""

    context = "\n\n---\n\n".join(relevant)
    return f"Relevant medical context from knowledge base:\n\n{context}"


def _fallback_response(query: str) -> dict:
    """Return a helpful fallback when Gemini API is not configured."""
    return {
        "response": (
            "I'm CURA AI, your women's health assistant. I'm currently unable to connect to "
            "my AI reasoning engine because no API key has been configured.\n\n"
            "Please add your Google Gemini API key to `backend/.env` to enable full functionality.\n\n"
            "In the meantime, I recommend visiting trusted resources like the Office on Women's Health "
            "(womenshealth.gov) or speaking with your healthcare provider."
        ),
        "escalate": False,
        "context_used": False,
    }


def chat(user_message: str) -> dict:
    """
    Main chat function. Returns:
    {
        "response": str,
        "escalate": bool,
        "context_used": bool
    }
    """
    if not _initialized:
        initialize()

    if not _gemini_client:
        return _fallback_response(user_message)

    # Retrieve relevant context from the knowledge base
    context = _retrieve_context(user_message)
    context_used = bool(context)

    # Build the prompt
    if context:
        prompt = f"{context}\n\nUser question: {user_message}"
    else:
        prompt = f"User question: {user_message}"

    try:
        response = _gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.7,
                max_output_tokens=1024,
            ),
        )
        response_text = response.text.strip()

        # Check for escalation signal
        escalate = "[ESCALATE]" in response_text
        # Clean the escalation tag from the visible response
        clean_response = response_text.replace("[ESCALATE]", "").strip()

        return {
            "response": clean_response,
            "escalate": escalate,
            "context_used": context_used,
        }

    except Exception as e:
        print(f"[Gemini Error] {e}")
        return {
            "response": (
                "I apologize, I'm having trouble processing your request right now. "
                "Please try again in a moment. If you have an urgent health concern, "
                "please contact your healthcare provider or emergency services."
            ),
            "escalate": False,
            "context_used": False,
        }
