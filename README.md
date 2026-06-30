# 🌸 Fille AI — Women's Health Chatbot

An AI-powered women's health assistant combining semantic search (Sentence Transformers), Google Gemini, and real-time doctor consultations via Socket.io.

## Architecture

```
frontend/ (Next.js 14)  →  backend/ (FastAPI + Python)  →  Gemini API
                        →  server/ (Node.js + Socket.io) →  Doctor Dashboard
```

## Quick Start

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv env
env\Scripts\activate        # Windows
pip install -r requirements.txt

# Add your Gemini key to backend/.env
# GEMINI_API_KEY=your_key_here

uvicorn main:app --host 0.0.0.0 --port 8000
```

**First run** downloads `all-MiniLM-L6-v2` (~90MB) and the `altaidevorg/women-health-mini` dataset.

### 2. Socket Server (Node.js)

```bash
cd server
npm install
node server.js
```

### 3. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open → **http://localhost:3000**  
Doctor Dashboard → **http://localhost:3000/doctor** (login: `doctor` / `doctor123`)

## Environment Variables

| File | Variable | Value |
|------|----------|-------|
| `backend/.env` | `GEMINI_API_KEY` | Your Google Gemini API key |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:8000` |
| `frontend/.env.local` | `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:5000` |

## API Reference

### `POST /chat/`
```json
// Request
{ "message": "What are common PCOS symptoms?" }

// Response
{ "response": "...", "escalate": false, "context_used": true }
```

### `GET /health`
Returns server status, model load state, and dataset entry count.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript |
| Chatbot API | FastAPI, Python |
| AI / RAG | Sentence Transformers (all-MiniLM-L6-v2) + Google Gemini |
| Dataset | altaidevorg/women-health-mini (Hugging Face) |
| Real-time | Node.js, Socket.io |

## License

MIT
