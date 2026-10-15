"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Send, Stethoscope, ArrowLeft, User, Loader2 } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

interface ChatMessage {
  id: string;
  content: string;
  role: "patient" | "doctor";
  timestamp: string;
  isSystem?: boolean;
}

type Status = "connecting" | "waiting" | "active" | "ended";

// ─── Login Gate ───────────────────────────────────────────────────────────────
function PatientLogin({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    onJoin(trimmed);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="glass-card fade-in"
        style={{ width: "100%", maxWidth: "400px", padding: "48px 40px" }}
      >
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.15))",
              border: "1.5px solid rgba(139,92,246,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 0 30px rgba(139,92,246,0.2)",
            }}
          >
            <User size={30} color="#a78bfa" />
          </div>
          <h1
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "#f8f4ff",
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            Talk to a Doctor
          </h1>
          <p style={{ color: "#7c6a9e", fontSize: "0.875rem", lineHeight: 1.6 }}>
            Enter your name to join the queue. A doctor will connect with you shortly.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.78rem",
                color: "#c4b5e0",
                marginBottom: "8px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Your Name
            </label>
            <input
              id="patient-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g. Sarah Johnson"
              autoFocus
              autoComplete="given-name"
              maxLength={50}
              style={{ height: "48px" }}
            />
          </div>

          <button
            id="patient-join-btn"
            type="submit"
            disabled={name.trim().length < 2}
            className="btn btn-primary"
            style={{ height: "50px", fontSize: "1rem" }}
          >
            <Stethoscope size={17} />
            Join Queue
          </button>
        </form>

        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <button className="btn btn-ghost btn-sm">
              <ArrowLeft size={13} /> Back to AI Chat
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Patient Chat Room ────────────────────────────────────────────────────────
function PatientChat({ patientName }: { patientName: string }) {
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState("");
  const [status, setStatus]         = useState<Status>("connecting");
  const [doctorTyping, setDoctorTyping] = useState(false);

  // Refs that are always fresh inside socket callbacks
  const socketRef      = useRef<Socket | null>(null);
  const sessionIdRef   = useRef<string>("");
  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const typingTimer    = useRef<NodeJS.Timeout | null>(null);

  /* ── Push a system pill message ── */
  const pushSystem = useCallback((content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `sys_${Date.now()}_${Math.random()}`,
        content,
        role: "patient",
        timestamp: new Date().toISOString(),
        isSystem: true,
      },
    ]);
  }, []);

  /* ── Socket setup — create a FRESH connection (not the shared singleton) ── */
  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Patient] connected:", socket.id);
      // Emit patient:join every time we (re)connect so the server
      // always knows our current socket.id → session mapping
      socket.emit("patient:join", {
        sessionId: sessionIdRef.current || undefined,
        patientName,
      });
    });

    socket.on("connect_error", (err) => {
      console.error("[Patient] connect_error:", err.message);
    });

    socket.on("session:created", ({ sessionId }: { sessionId: string }) => {
      console.log("[Patient] session:created", sessionId);
      sessionIdRef.current = sessionId;
      setStatus("waiting");
      pushSystem("You've joined the queue. A doctor will connect with you shortly…");
    });

    socket.on("doctor:joined", ({ message }: { message: string }) => {
      console.log("[Patient] doctor:joined");
      setStatus("active");
      pushSystem(message || "A doctor has joined your session.");
      setTimeout(() => inputRef.current?.focus(), 150);
    });

    socket.on("doctor:left", () => {
      console.log("[Patient] doctor:left");
      setStatus("ended");
      pushSystem("The doctor has left the session. Thank you for using CURA.");
    });

    socket.on("message:received", (msg: ChatMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev; // deduplicate
        return [...prev, msg];
      });
    });

    socket.on("typing:start", ({ role }: { role: string }) => {
      if (role === "doctor") setDoctorTyping(true);
    });

    socket.on("typing:stop", ({ role }: { role: string }) => {
      if (role === "doctor") setDoctorTyping(false);
    });

    /* Cleanup: disconnect this dedicated socket when component unmounts */
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, doctorTyping]);

  /* Send a message */
  const sendMessage = useCallback(() => {
    const text = input.trim();
    const sid  = sessionIdRef.current;
    const sock = socketRef.current;
    if (!text || !sid || !sock) return;

    sock.emit("message:send", { sessionId: sid, content: text, role: "patient" });
    sock.emit("typing:stop",  { sessionId: sid, role: "patient" });
    setInput("");
  }, [input]);

  /* Handle textarea changes */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const sid  = sessionIdRef.current;
    const sock = socketRef.current;
    if (!sid || !sock) return;
    sock.emit("typing:start", { sessionId: sid, role: "patient" });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      sock.emit("typing:stop", { sessionId: sid, role: "patient" });
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* Status display */
  const statusMap: Record<Status, { label: string; color: string; dot: string }> = {
    connecting: { label: "Connecting…",          color: "#7c6a9e", dot: "#6b7280" },
    waiting:    { label: "Waiting for a doctor…", color: "#f59e0b", dot: "#f59e0b" },
    active:     { label: "Doctor connected",      color: "#34d399", dot: "#34d399" },
    ended:      { label: "Session ended",         color: "#6b7280", dot: "#6b7280" },
  };
  const sc = statusMap[status];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: "760px", margin: "0 auto" }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="Back">
            <ArrowLeft size={16} />
          </button>
        </Link>

        <div
          style={{
            width: "40px", height: "40px", borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.15))",
            border: "1.5px solid rgba(52,211,153,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(52,211,153,0.15)",
          }}
        >
          <Stethoscope size={18} color="#34d399" />
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f8f4ff", margin: 0 }}>
            Doctor Consultation
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
            {status === "connecting" ? (
              <Loader2 size={10} color="#7c6a9e" style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <span
                style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: sc.dot, display: "inline-block",
                  boxShadow: status === "active" ? "0 0 8px rgba(52,211,153,0.7)" : "none",
                }}
              />
            )}
            <span style={{ fontSize: "0.72rem", color: sc.color }}>{sc.label}</span>
          </div>
        </div>

        {/* Patient name chip */}
        <div
          style={{
            padding: "5px 12px", borderRadius: "999px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", gap: "6px",
          }}
        >
          <User size={12} color="#a78bfa" />
          <span style={{ fontSize: "0.78rem", color: "#c4b5e0", fontWeight: 500 }}>{patientName}</span>
        </div>
      </div>

      {/* ── Status banner ───────────────────────────────────────────── */}
      {status === "connecting" && (
        <div
          className="fade-in"
          style={{
            margin: "16px 20px 0", padding: "16px 20px",
            borderRadius: "14px",
            background: "rgba(107,114,128,0.06)",
            border: "1px solid rgba(107,114,128,0.2)",
            display: "flex", alignItems: "center", gap: "12px",
          }}
        >
          <Loader2 size={20} color="#7c6a9e" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <p style={{ fontSize: "0.85rem", color: "#7c6a9e", margin: 0 }}>
            Connecting to server…
          </p>
        </div>
      )}

      {status === "waiting" && (
        <div
          className="fade-in"
          style={{
            margin: "16px 20px 0", padding: "16px 20px",
            borderRadius: "14px",
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)",
            display: "flex", alignItems: "center", gap: "14px",
          }}
        >
          <div
            style={{
              width: "40px", height: "40px", flexShrink: 0,
              borderRadius: "50%",
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px",
            }}
          >
            ⏳
          </div>
          <div>
            <p style={{ fontWeight: 600, color: "#fbbf24", margin: "0 0 2px", fontSize: "0.9rem" }}>
              You're in the queue
            </p>
            <p style={{ color: "#7c6a9e", fontSize: "0.78rem", margin: 0 }}>
              A doctor will join shortly. This page will update automatically — please keep it open.
            </p>
          </div>
        </div>
      )}

      {status === "active" && (
        <div
          className="fade-in"
          style={{
            margin: "16px 20px 0", padding: "12px 18px",
            borderRadius: "12px",
            background: "rgba(52,211,153,0.07)",
            border: "1px solid rgba(52,211,153,0.25)",
            display: "flex", alignItems: "center", gap: "10px",
          }}
        >
          <span style={{ fontSize: "16px" }}>🩺</span>
          <p style={{ fontSize: "0.83rem", color: "#34d399", margin: 0, fontWeight: 500 }}>
            A doctor has joined your session — type below to chat.
          </p>
        </div>
      )}

      {/* ── Messages ────────────────────────────────────────────────── */}
      <div
        className="scroll-container"
        style={{
          flex: 1, padding: "16px 20px",
          display: "flex", flexDirection: "column", gap: "10px",
          overflowY: "auto",
        }}
      >
        {messages.length === 0 && status !== "connecting" && (
          <div style={{ textAlign: "center", color: "#7c6a9e", fontSize: "0.82rem", marginTop: "32px" }}>
            Messages will appear here once you&apos;re connected with a doctor.
          </div>
        )}

        {messages.map((msg) => {
          /* System pill */
          if (msg.isSystem) {
            return (
              <div key={msg.id} style={{ textAlign: "center", padding: "2px 0" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "0.75rem", color: "#7c6a9e",
                    background: "rgba(255,255,255,0.04)",
                    padding: "5px 14px", borderRadius: "999px",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {msg.content}
                </span>
              </div>
            );
          }

          const isMe = msg.role === "patient";
          return (
            <div
              key={msg.id}
              className="message-enter"
              style={{
                display: "flex",
                justifyContent: isMe ? "flex-end" : "flex-start",
                gap: "8px", alignItems: "flex-end",
              }}
            >
              {/* Doctor avatar */}
              {!isMe && (
                <div
                  style={{
                    width: "30px", height: "30px", borderRadius: "50%",
                    background: "linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.15))",
                    border: "1px solid rgba(52,211,153,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: "13px",
                  }}
                >🩺</div>
              )}

              <div style={{ maxWidth: "68%" }}>
                {!isMe && (
                  <p style={{ fontSize: "0.68rem", color: "#34d399", marginBottom: "4px", fontWeight: 600 }}>
                    Doctor
                  </p>
                )}
                <div
                  style={{
                    padding: "11px 15px",
                    borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isMe
                      ? "linear-gradient(135deg, #7c3aed, #db2777)"
                      : "rgba(255,255,255,0.05)",
                    border: isMe ? "none" : "1px solid rgba(255,255,255,0.09)",
                    color: "#f8f4ff", fontSize: "0.9rem", lineHeight: 1.6,
                    boxShadow: isMe ? "0 4px 16px rgba(124,58,237,0.3)" : "none",
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                </div>
                <p
                  style={{
                    fontSize: "0.65rem", color: "#7c6a9e",
                    margin: "4px 2px 0",
                    textAlign: isMe ? "right" : "left",
                  }}
                >
                  {format(new Date(msg.timestamp), "h:mm a")}
                </p>
              </div>

              {/* Patient avatar */}
              {isMe && (
                <div
                  style={{
                    width: "30px", height: "30px", borderRadius: "50%",
                    background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: "13px",
                  }}
                >👤</div>
              )}
            </div>
          );
        })}

        {/* Doctor typing */}
        {doctorTyping && (
          <div className="message-enter" style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div
              style={{
                width: "30px", height: "30px", borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.15))",
                border: "1px solid rgba(52,211,153,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontSize: "13px",
              }}
            >🩺</div>
            <div
              style={{
                padding: "12px 16px", borderRadius: "18px 18px 18px 4px",
                background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)",
              }}
            >
              <div className="typing-dots">
                <div className="typing-dot" style={{ background: "#34d399" }} />
                <div className="typing-dot" style={{ background: "#34d399" }} />
                <div className="typing-dot" style={{ background: "#34d399" }} />
              </div>
            </div>
          </div>
        )}

        {/* Session ended */}
        {status === "ended" && (
          <div className="fade-in" style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ fontSize: "0.8rem", color: "#7c6a9e", marginBottom: "12px" }}>Session has ended</p>
            <Link href="/" style={{ textDecoration: "none" }}>
              <button className="btn btn-ghost btn-sm">
                <ArrowLeft size={13} /> Return to CURA AI
              </button>
            </Link>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 20px 20px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(10px)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex", gap: "10px", alignItems: "flex-end",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${status === "active" ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: "18px",
            padding: "10px 14px",
            opacity: status === "active" ? 1 : 0.45,
            transition: "all 0.4s ease",
          }}
        >
          <textarea
            id="patient-message-input"
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={status !== "active"}
            placeholder={
              status === "connecting" ? "Connecting to server…" :
              status === "waiting"    ? "Chat opens once a doctor joins your session…" :
              status === "ended"      ? "Session ended" :
                                       "Type your message to the doctor…"
            }
            rows={1}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#f8f4ff", fontFamily: "'Inter', sans-serif",
              fontSize: "0.9375rem", lineHeight: 1.6, resize: "none",
              maxHeight: "120px", overflowY: "auto",
              cursor: status !== "active" ? "default" : "text",
            }}
          />
          <button
            id="patient-send-btn"
            onClick={sendMessage}
            disabled={status !== "active" || !input.trim()}
            className="btn btn-primary btn-icon"
            style={{ flexShrink: 0, width: "42px", height: "42px" }}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: "0.68rem", color: "#4a3a6e", marginTop: "8px" }}>
          {status === "active"
            ? "Enter to send · Shift+Enter for new line"
            : status === "waiting"
            ? "⏳ This page updates automatically when a doctor joins"
            : ""}
        </p>
      </div>
    </div>
  );
}

// ─── Spin keyframe (inline) ───────────────────────────────────────────────────
const SpinStyle = () => (
  <style>{`
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `}</style>
);

// ─── Page root ────────────────────────────────────────────────────────────────
export default function PatientPage() {
  const [patientName, setPatientName] = useState<string | null>(null);

  return (
    <>
      <SpinStyle />
      {patientName
        ? <PatientChat patientName={patientName} />
        : <PatientLogin onJoin={setPatientName} />}
    </>
  );
}
