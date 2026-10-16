import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const backendRes = await fetch(`${BACKEND_URL}/chat/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // 30-second timeout for slow cold starts
      signal: AbortSignal.timeout(30_000),
    });

    const data = await backendRes.json().catch(() => ({
      response: "⚠️ The AI backend returned an unexpected response. Please try again.",
      escalate: false,
      context_used: false,
    }));

    // 503 = still warming up — surface gracefully
    if (backendRes.status === 503) {
      return NextResponse.json(
        {
          response:
            "⏳ CURA AI is still warming up (loading the AI model). Please wait a moment and try again!",
          escalate: false,
          context_used: false,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        response: `⚠️ Could not reach the AI backend: ${message}. Please try again shortly.`,
        escalate: false,
        context_used: false,
      },
      { status: 200 } // Return 200 so the frontend renders the message normally
    );
  }
}
