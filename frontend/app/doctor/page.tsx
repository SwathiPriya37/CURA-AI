"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { format } from "date-fns";
import { Stethoscope, LogOut, Send, Users, MessageSquare, Clock, ArrowLeft, UserCheck } from "lucide-react";
import Link from "next/link";

interface WaitingSession {
  sessionId: string;
  patientName: string;
  createdAt: string;
}

interface DoctorMessage {
  id: string;
  content: string;
  role: "patient" | "doctor";
  timestamp: string;
}

interface ActiveSession extends WaitingSession {
  messages: DoctorMessage[];
}

// ─── Login Gate ──────────────────────────────────────────────────────────────
function LoginGate({ onLogin }: { onLogin: (name: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "doctor" && password === "doctor123") {
      onLogin("Dr. " + (username.charAt(0).toUpperCase() + username.slice(1)));
    } else {
      setError("Invalid credentials. Use doctor / doctor123");
    }
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
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "40px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.15))",
              border: "1px solid rgba(52,211,153,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "28px",
            }}
          >
            🩺
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f8f4ff", margin: "0 0 6px" }}>
            Doctor Portal
          </h1>
          <p style={{ color: "#7c6a9e", fontSize: "0.875rem" }}>
            Sign in to access patient consultations
          </p>
          <div
            style={{
              marginTop: "12px",
              padding: "8px 16px",
              borderRadius: "8px",
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.2)",
              fontSize: "0.75rem",
              color: "#fbbf24",
            }}
          >
            Demo: username <strong>doctor</strong> / password <strong>doctor123</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#c4b5e0", marginBottom: "6px", fontWeight: 600 }}>
              Username
            </label>
            <input
              id="doctor-login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="doctor"
              autoComplete="username"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#c4b5e0", marginBottom: "6px", fontWeight: 600 }}>
              Password
            </label>
            <input
              id="doctor-login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p style={{ fontSize: "0.8rem", color: "#fb7185", textAlign: "center" }}>{error}</p>
          )}

          <button
            id="doctor-login-submit"
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: "8px" }}
          >
            <Stethoscope size={16} />
            Sign In to Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Doctor Dashboard ─────────────────────────────────────────────────────────
function Dashboard({ doctorName, onLogout }: { doctorName: string; onLogout: () => void }) {
  const [waitingList, setWaitingList] = useState<WaitingSession[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [patientTyping, setPatientTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const socket = getSocket();

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.emit("doctor:join", { doctorName });

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("doctor:registered", () => setIsConnected(true));

    socket.on("waiting:list", (list: WaitingSession[]) => {
      setWaitingList(list);
    });

    socket.on("patient:waiting", (info: WaitingSession) => {
      setWaitingList((prev) => {
        if (prev.find((s) => s.sessionId === info.sessionId)) return prev;
        return [...prev, info];
      });
    });

    socket.on("session:joined", ({ sessionId, patientName, history }: { sessionId: string; patientName: string; history: DoctorMessage[] }) => {
      setActiveSession({ sessionId, patientName, createdAt: new Date().toISOString(), messages: history || [] });
      setWaitingList((prev) => prev.filter((s) => s.sessionId !== sessionId));
    });

    socket.on("message:received", (msg: DoctorMessage) => {
      setActiveSession((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
    });

    socket.on("typing:start", ({ role }: { role: string }) => {
      if (role === "patient") setPatientTyping(true);
    });

    socket.on("typing:stop", ({ role }: { role: string }) => {
      if (role === "patient") setPatientTyping(false);
    });

    socket.on("patient:left", () => {
      setActiveSession((prev) => prev
        ? { ...prev, messages: [...prev.messages, { id: `sys_${Date.now()}`, content: "Patient has left the session.", role: "patient", timestamp: new Date().toISOString() }] }
        : prev
      );
    });

    return () => {
      ["connect", "disconnect", "doctor:registered", "waiting:list", "patient:waiting",
       "session:joined", "message:received", "typing:start", "typing:stop", "patient:left"]
        .forEach((ev) => socket.off(ev));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, patientTyping]);

  const acceptPatient = (sessionId: string) => {
    socket.emit("doctor:accept", { sessionId });
  };

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !activeSession) return;
    socket.emit("message:send", { sessionId: activeSession.sessionId, content: text, role: "doctor" });
    setInput("");
    socket.emit("typing:stop", { sessionId: activeSession.sessionId, role: "doctor" });
  }, [input, activeSession, socket]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (activeSession) {
      socket.emit("typing:start", { sessionId: activeSession.sessionId, role: "doctor" });
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit("typing:stop", { sessionId: activeSession.sessionId, role: "doctor" });
      }, 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Left panel — waiting queue */}
      <div
        style={{
          width: "300px",
          minWidth: "300px",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "rgba(255,255,255,0.03)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "linear-gradient(135deg, rgba(52,211,153,0.1), rgba(16,185,129,0.05))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div
              style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(52,211,153,0.3), rgba(16,185,129,0.2))",
                border: "1px solid rgba(52,211,153,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              🩺
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#f8f4ff", margin: 0 }}>{doctorName}</p>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span className="status-dot" style={{ background: isConnected ? "#34d399" : "#6b7280", boxShadow: isConnected ? "0 0 8px rgba(52,211,153,0.6)" : "none" }} />
                <span style={{ fontSize: "0.7rem", color: "#7c6a9e" }}>{isConnected ? "Online" : "Offline"}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <button id="doctor-back-home" className="btn btn-ghost btn-sm">
                <ArrowLeft size={14} /> Back
              </button>
            </Link>
            <button id="doctor-logout" onClick={onLogout} className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", color: "#fb7185", borderColor: "rgba(251,113,133,0.3)" }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* Waiting patients */}
        <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Users size={14} color="#7c6a9e" />
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#7c6a9e", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Waiting Patients
            </span>
            {waitingList.length > 0 && (
              <span
                style={{
                  background: "#ec4899",
                  color: "white",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: "999px",
                  marginLeft: "auto",
                }}
              >
                {waitingList.length}
              </span>
            )}
          </div>

          {waitingList.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 16px",
                color: "#7c6a9e",
                fontSize: "0.85rem",
              }}
            >
              <p style={{ fontSize: "24px", marginBottom: "8px" }}>✨</p>
              <p>No patients waiting</p>
              <p style={{ fontSize: "0.75rem", marginTop: "4px", color: "#4a3a6e" }}>You'll be notified when a patient requests help</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {waitingList.map((session) => (
                <div
                  key={session.sessionId}
                  className="glass-card fade-in"
                  style={{ padding: "14px", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <div
                      style={{
                        width: "34px", height: "34px", borderRadius: "50%",
                        background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "15px",
                      }}
                    >
                      👤
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "#f8f4ff", margin: 0 }}>{session.patientName}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                        <Clock size={11} color="#7c6a9e" />
                        <span style={{ fontSize: "0.7rem", color: "#7c6a9e" }}>
                          {format(new Date(session.createdAt), "h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    id={`accept-patient-${session.sessionId.slice(0, 8)}`}
                    onClick={() => acceptPatient(session.sessionId)}
                    className="btn btn-sm"
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.15))",
                      border: "1px solid rgba(52,211,153,0.3)",
                      color: "#34d399",
                      justifyContent: "center",
                    }}
                  >
                    <UserCheck size={13} /> Accept Consultation
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — active chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!activeSession ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              color: "#7c6a9e",
              textAlign: "center",
              padding: "40px",
            }}
          >
            <div style={{ fontSize: "56px" }}>🩺</div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#c4b5e0", margin: 0 }}>
              Ready to Consult
            </h2>
            <p style={{ fontSize: "0.875rem", maxWidth: "320px" }}>
              Accept a patient from the waiting list to begin a consultation. You'll receive a notification as soon as a patient requests help.
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(52,211,153,0.05)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
                }}
              >
                👤
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f8f4ff", margin: 0 }}>{activeSession.patientName}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="status-dot status-online" />
                  <span style={{ fontSize: "0.75rem", color: "#34d399" }}>Active session</span>
                </div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <span className="badge badge-green">
                  <MessageSquare size={10} /> Live Chat
                </span>
              </div>
            </div>

            {/* Messages */}
            <div
              className="scroll-container"
              style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {activeSession.messages.map((msg) => {
                const isDoctor = msg.role === "doctor";
                return (
                  <div
                    key={msg.id}
                    className="message-enter"
                    style={{ display: "flex", justifyContent: isDoctor ? "flex-end" : "flex-start" }}
                  >
                    <div
                      style={{
                        maxWidth: "72%",
                        padding: "12px 16px",
                        borderRadius: isDoctor ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: isDoctor
                          ? "linear-gradient(135deg, #059669, #047857)"
                          : "rgba(255,255,255,0.05)",
                        border: isDoctor ? "none" : "1px solid rgba(255,255,255,0.08)",
                        color: "#f8f4ff",
                        fontSize: "0.9rem",
                        lineHeight: 1.6,
                      }}
                    >
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.7rem", color: isDoctor ? "rgba(255,255,255,0.6)" : "#7c6a9e", textAlign: "right" }}>
                        {format(new Date(msg.timestamp), "h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}

              {patientTyping && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="typing-dots">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              style={{
                padding: "16px 24px 20px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                gap: "10px",
                alignItems: "flex-end",
              }}
            >
              <textarea
                id="doctor-message-input"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your response to the patient…"
                rows={1}
                className="input"
                style={{ flex: 1, resize: "none", maxHeight: "120px", overflowY: "auto" }}
              />
              <button
                id="doctor-send-button"
                onClick={sendMessage}
                disabled={!input.trim()}
                className="btn btn-primary btn-icon"
                aria-label="Send"
              >
                <Send size={17} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DoctorPage() {
  const [doctorName, setDoctorName] = useState<string | null>(null);

  return doctorName
    ? <Dashboard doctorName={doctorName} onLogout={() => setDoctorName(null)} />
    : <LoginGate onLogin={setDoctorName} />;
}
