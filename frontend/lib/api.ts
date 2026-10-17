// All requests go through Next.js API proxy routes (/api/chat, /api/health)
// so the browser never directly contacts Render — no CORS issues.

export interface ChatResponse {
  response: string;
  escalate: boolean;
  context_used: boolean;
  warming_up?: boolean;
}

export interface HealthStatus {
  ok: boolean;
  model_loaded?: boolean;
  gemini_configured?: boolean;
  status?: string;
}

const WARMUP_RETRY_DELAY_MS = 4000;
const WARMUP_MAX_RETRIES = 3;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendChatMessage(
  message: string,
  onWarmup?: (attempt: number, max: number) => void
): Promise<ChatResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= WARMUP_MAX_RETRIES; attempt++) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    // 503 = backend still warming up — auto-retry with notification
    if (res.status === 503) {
      const data = await res.json().catch(() => ({})) as ChatResponse;
      if (attempt < WARMUP_MAX_RETRIES) {
        onWarmup?.(attempt + 1, WARMUP_MAX_RETRIES);
        await sleep(WARMUP_RETRY_DELAY_MS);
        continue;
      }
      // Exhausted retries — return the warming_up message
      return data;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, string>;
      lastError = new Error(err.detail || err.response || `HTTP ${res.status}: ${res.statusText}`);
      break;
    }

    return res.json();
  }

  throw lastError ?? new Error("Failed to send message");
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch("/api/health", { signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, ...data };
  } catch {
    return { ok: false, status: "offline" };
  }
}
