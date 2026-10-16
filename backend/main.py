"""
CURA AI — FastAPI Backend
POST /chat/   — main chatbot endpoint
GET  /health  — health check
"""

import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import chatbot


# ─── Lifespan (startup/shutdown) ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: kick off heavy init in a background thread so the port binds immediately.
    # Render (and similar hosts) require the port to open within ~60s of startup.
    print("Starting CURA AI backend — initializing model in background thread...")
    init_thread = threading.Thread(target=chatbot.initialize, daemon=True)
    init_thread.start()
    yield
    # Shutdown (nothing to clean up)
    print("Shutting down CURA AI backend.")


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CURA AI — Women's Health Chatbot API",
    description="RAG-powered chatbot using Sentence Transformers + Google Gemini",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for production; restrict after deployment if needed
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Schemas ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User's message")


class ChatResponse(BaseModel):
    response: str
    escalate: bool = False
    context_used: bool = False


# ─── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {
        "status": "ok" if chatbot._initialized else "warming_up",
        "model_loaded": chatbot._initialized,
        "dataset_entries": len(chatbot._dataset_texts),
        "gemini_configured": chatbot._gemini_client is not None,
    }


@app.post("/chat/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Send a message to CURA AI and receive a response.

    - **message**: The user's health question or message
    - **response**: AI-generated response
    - **escalate**: True if the AI recommends connecting to a doctor
    - **context_used**: True if relevant dataset context was retrieved
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # If still initializing, return a friendly 503 instead of crashing
    if not chatbot._initialized:
        raise HTTPException(
            status_code=503,
            detail="CURA AI is still warming up. Please try again in a few moments.",
        )

    result = chatbot.chat(request.message.strip())
    return ChatResponse(**result)
