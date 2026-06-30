"""
Fille AI — FastAPI Backend
POST /chat/   — main chatbot endpoint
GET  /health  — health check
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import chatbot


# ─── Lifespan (startup/shutdown) ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialise the chatbot pipeline (loads model + dataset + embeddings)
    print("Starting Fille AI backend...")
    chatbot.initialize()
    yield
    # Shutdown (nothing to clean up)
    print("Shutting down Fille AI backend.")


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Fille AI — Women's Health Chatbot API",
    description="RAG-powered chatbot using Sentence Transformers + Google Gemini",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
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
        "status": "ok",
        "model_loaded": chatbot._initialized,
        "dataset_entries": len(chatbot._dataset_texts),
        "gemini_configured": chatbot._gemini_model is not None,
    }


@app.post("/chat/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Send a message to Fille AI and receive a response.

    - **message**: The user's health question or message
    - **response**: AI-generated response
    - **escalate**: True if the AI recommends connecting to a doctor
    - **context_used**: True if relevant dataset context was retrieved
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    result = chatbot.chat(request.message.strip())
    return ChatResponse(**result)
