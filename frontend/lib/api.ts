// All requests go through Next.js API proxy routes (/api/chat, /api/health)
// so the browser never directly contacts Render — no CORS issues.

export interface ChatResponse {
  response: string;
  escalate: boolean;
  context_used: boolean;
}

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.response || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}
