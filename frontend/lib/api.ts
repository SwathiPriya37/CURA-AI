const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatResponse {
  response: string;
  escalate: boolean;
  context_used: boolean;
}

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  // Backend is warming up — return a friendly message instead of throwing
  if (res.status === 503) {
    return {
      response:
        "⏳ CURA AI is still warming up (loading the AI model). Please wait a moment and try again!",
      escalate: false,
      context_used: false,
    };
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}
