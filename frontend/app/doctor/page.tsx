"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
import { format, formatDistanceToNow } from "date-fns";
import {
  Stethoscope,
  LogOut,
  Send,
  Users,
  MessageSquare,
  Clock,
  ArrowLeft,
  UserCheck,
  ChevronDown,
  Search,
  Zap,
  FileText,
  Activity,
  X,
  Bell,
  Hash,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
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
  isSystem?: boolean;
}

interface SessionNote {
  id: string;
  text: string;
  createdAt: string;
}

interface ActiveSession extends WaitingSession {
  messages: DoctorMessage[];
  notes: SessionNote[];
  messageCount: number;
  lastActivity: string;
  status: "active" | "ended";
}

// ─── Quick Reply Templates ────────────────────────────────────────────────────
const QUICK_REPLIES = [
  "I understand your concern. Could you tell me more about when these symptoms started?",
  "Based on what you've shared, I'd recommend scheduling an in-person appointment.",
  "These symptoms are common and typically not a cause for alarm, but let's discuss further.",
  "I'm reviewing your information now. Please give me a moment.",
  "That's a great question. Here's what you should know:",
  "I recommend consulting with a specialist for this. I can provide a referral.",
  "Please don't hesitate to visit the emergency room if symptoms worsen.",
  "Thank you for sharing that. Let me provide some guidance.",
];

// ─── Login Gate ───────────────────────────────────────────────────────────────
function LoginGate({ onLogin }: { onLogin: (name: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    if (username === "doctor" && password === "doctor123") {
      onLogin("Dr. " + username.charAt(0).toUpperCase() + username.slice(1));
    } else {
      setError("Invalid credentials. Use doctor / doctor123");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(52,211,153,0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.1) 0%, transparent 50%)",
      }}
    >
      <div
        className="glass-card fade-in"
        style={{ width: "100%", maxWidth: "420px", padding: "48px 40px" }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.1))",
              border: "1.5px solid rgba(52,211,153,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 0 30px rgba(52,211,153,0.2)",
            }}
          >
            <Stethoscope size={30} color="#34d399" />
          </div>
          <h1
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "#f8f4ff",
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
            }}
          >
            Doctor Portal
          </h1>
          <p style={{ color: "#7c6a9e", fontSize: "0.875rem" }}>
            CURA AI — Clinical Dashboard
          </p>
          <div
            style={{
              marginTop: "14px",
              padding: "8px 16px",
              borderRadius: "10px",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              fontSize: "0.75rem",
              color: "#fbbf24",
              display: "inline-block",
            }}
          >
            Demo: <strong>doctor</strong> / <strong>doctor123</strong>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                color: "#c4b5e0",
                marginBottom: "8px",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              USERNAME
            </label>
            <input
              id="doctor-login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="doctor"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                color: "#c4b5e0",
                marginBottom: "8px",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              PASSWORD
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(251,113,133,0.1)",
                border: "1px solid rgba(251,113,133,0.2)",
              }}
            >
              <AlertCircle size={14} color="#fb7185" />
              <p style={{ fontSize: "0.8rem", color: "#fb7185", margin: 0 }}>
                {error}
              </p>
            </div>
          )}

          <button
            id="doctor-login-submit"
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: "8px", height: "48px", fontSize: "0.95rem" }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ opacity: 0.8 }}>Signing in…</span>
            ) : (
              <>
                <Stethoscope size={16} /> Sign In to Dashboard
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Notification Toast ───────────────────────────────────────────────────────
function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="toast"
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        background: "rgba(22,13,46,0.97)",
        border: "1px solid rgba(52,211,153,0.35)",
        borderRadius: "14px",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        maxWidth: "320px",
      }}
    >
      <Bell size={16} color="#34d399" />
      <p
        style={{ fontSize: "0.875rem", color: "#f8f4ff", margin: 0, flex: 1 }}
      >
        {message}
      </p>
      <button
        onClick={onDismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#7c6a9e",
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Session History Tab ──────────────────────────────────────────────────────
function HistoryTab({
  messages,
  patientName,
}: {
  messages: DoctorMessage[];
  patientName: string;
}) {
  const patientMsgs = messages.filter(
    (m) => m.role === "patient" && !m.isSystem
  );
  const doctorMsgs = messages.filter(
    (m) => m.role === "doctor" && !m.isSystem
  );

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        {[
          { label: "Total", value: messages.filter((m) => !m.isSystem).length, color: "#a78bfa" },
          { label: "Patient", value: patientMsgs.length, color: "#f472b6" },
          { label: "Doctor", value: doctorMsgs.length, color: "#34d399" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "10px",
              padding: "10px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "1.3rem", fontWeight: 800, color: stat.color, margin: 0 }}>
              {stat.value}
            </p>
            <p style={{ fontSize: "0.68rem", color: "#7c6a9e", margin: 0, marginTop: "2px" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Message timeline */}
      <div style={{ marginTop: "4px" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#7c6a9e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
          Conversation Timeline
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto" }} className="scroll-container">
          {messages.filter((m) => !m.isSystem).map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                background: msg.role === "doctor" ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.03)",
                border: msg.role === "doctor" ? "1px solid rgba(52,211,153,0.15)" : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>
                {msg.role === "doctor" ? "🩺" : "👤"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: msg.role === "doctor" ? "#34d399" : "#c4b5e0" }}>
                    {msg.role === "doctor" ? "You" : patientName}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "#7c6a9e" }}>
                    {format(new Date(msg.timestamp), "h:mm a")}
                  </span>
                </div>
                <p style={{ fontSize: "0.78rem", color: "#c4b5e0", margin: 0, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
          {messages.filter((m) => !m.isSystem).length === 0 && (
            <p style={{ fontSize: "0.8rem", color: "#7c6a9e", textAlign: "center", padding: "20px 0" }}>
              No messages yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────
function NotesTab({
  notes,
  onAddNote,
  onDeleteNote,
}: {
  notes: SessionNote[];
  onAddNote: (text: string) => void;
  onDeleteNote: (id: string) => void;
}) {
  const [noteInput, setNoteInput] = useState("");

  const handleAdd = () => {
    if (!noteInput.trim()) return;
    onAddNote(noteInput.trim());
    setNoteInput("");
  };

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", height: "100%" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <textarea
          id="doctor-note-input"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder="Add a clinical note…"
          rows={2}
          className="input"
          style={{ flex: 1, resize: "none", fontSize: "0.82rem" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          id="doctor-add-note"
          onClick={handleAdd}
          disabled={!noteInput.trim()}
          className="btn btn-primary btn-icon"
          style={{ alignSelf: "flex-end", width: "38px", height: "38px" }}
          aria-label="Add note"
        >
          <FileText size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }} className="scroll-container">
        {notes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#7c6a9e", fontSize: "0.8rem" }}>
            <FileText size={24} style={{ margin: "0 auto 8px", opacity: 0.3, display: "block" }} />
            No notes yet. Add clinical observations above.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(245,158,11,0.07)",
                border: "1px solid rgba(245,158,11,0.18)",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <p style={{ fontSize: "0.8rem", color: "#f8f4ff", margin: 0, lineHeight: 1.5, flex: 1 }}>
                  {note.text}
                </p>
                <button
                  onClick={() => onDeleteNote(note.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#7c6a9e", padding: "0", flexShrink: 0 }}
                  aria-label="Delete note"
                >
                  <X size={13} />
                </button>
              </div>
              <p style={{ fontSize: "0.65rem", color: "#7c6a9e", margin: "6px 0 0" }}>
                {format(new Date(note.createdAt), "h:mm a · MMM d")}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
  doctorName,
  onLogout,
}: {
  doctorName: string;
  onLogout: () => void;
}) {
  const [waitingList, setWaitingList] = useState<WaitingSession[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [patientTyping, setPatientTyping] = useState(false);
  const [sideTab, setSideTab] = useState<"queue" | "history" | "notes">("queue");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<ActiveSession[]>([]);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const socketRef    = useRef<Socket | null>(null);

  useEffect(() => {
    // Create a FRESH dedicated socket — no singleton conflicts
    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    function onConnect() {
      setIsConnected(true);
      socket.emit("doctor:join", { doctorName });
    }
    function onDisconnect() { setIsConnected(false); }
    function onDoctorRegistered() { setIsConnected(true); }

    function onWaitingList(list: WaitingSession[]) {
      setWaitingList(list);
    }

    function onPatientWaiting(info: WaitingSession) {
      setWaitingList((prev) => {
        if (prev.find((s) => s.sessionId === info.sessionId)) return prev;
        return [...prev, info];
      });
      setToast(`New patient waiting: ${info.patientName}`);
    }

    function onSessionJoined({ sessionId, patientName, history }: { sessionId: string; patientName: string; history: DoctorMessage[] }) {
      const session: ActiveSession = {
        sessionId,
        patientName,
        createdAt: new Date().toISOString(),
        messages: history || [],
        notes: [],
        messageCount: history?.length || 0,
        lastActivity: new Date().toISOString(),
        status: "active",
      };
      setActiveSession(session);
      setWaitingList((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setTotalSessions((n) => n + 1);
      setSideTab("queue");
      setToast(`Connected with ${patientName}`);
      setTimeout(() => inputRef.current?.focus(), 100);
    }

    function onMessageReceived(msg: DoctorMessage) {
      setActiveSession((prev) => {
        if (!prev) return prev;
        if (prev.messages.some(m => m.id === msg.id)) return prev;
        return {
          ...prev,
          messages: [...prev.messages, msg],
          messageCount: prev.messageCount + 1,
          lastActivity: new Date().toISOString(),
        };
      });
    }

    function onTypingStart({ role }: { role: string }) {
      if (role === "patient") setPatientTyping(true);
    }
    function onTypingStop({ role }: { role: string }) {
      if (role === "patient") setPatientTyping(false);
    }

    function onPatientLeft() {
      setActiveSession((prev) => {
        if (!prev) return prev;
        const endedSession = { ...prev, status: "ended" as const };
        setSessionHistory((h) => [endedSession, ...h]);
        return {
          ...prev,
          status: "ended",
          messages: [
            ...prev.messages,
            {
              id: `sys_${Date.now()}`,
              content: "Patient has left the session.",
              role: "patient" as const,
              timestamp: new Date().toISOString(),
              isSystem: true,
            },
          ],
        };
      });
      setToast("Patient has disconnected from the session");
    }

    socket.on("connect",          onConnect);
    socket.on("disconnect",       onDisconnect);
    socket.on("doctor:registered", onDoctorRegistered);
    socket.on("waiting:list",     onWaitingList);
    socket.on("patient:waiting",  onPatientWaiting);
    socket.on("session:joined",   onSessionJoined);
    socket.on("message:received", onMessageReceived);
    socket.on("typing:start",     onTypingStart);
    socket.on("typing:stop",      onTypingStop);
    socket.on("patient:left",     onPatientLeft);

    // If already connected (unlikely but safe), join immediately
    if (socket.connected) {
      socket.emit("doctor:join", { doctorName });
    }

    return () => {
      socket.off("connect",          onConnect);
      socket.off("disconnect",       onDisconnect);
      socket.off("doctor:registered", onDoctorRegistered);
      socket.off("waiting:list",     onWaitingList);
      socket.off("patient:waiting",  onPatientWaiting);
      socket.off("session:joined",   onSessionJoined);
      socket.off("message:received", onMessageReceived);
      socket.off("typing:start",     onTypingStart);
      socket.off("typing:stop",      onTypingStop);
      socket.off("patient:left",     onPatientLeft);
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, patientTyping]);

  const acceptPatient = (sessionId: string) => {
    socketRef.current?.emit("doctor:accept", { sessionId });
  };

  const sendMessage = useCallback(
    (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || !activeSession) return;
      const sock = socketRef.current;
      if (!sock) return;
      sock.emit("message:send", {
        sessionId: activeSession.sessionId,
        content: msg,
        role: "doctor",
      });
      setInput("");
      setShowQuickReplies(false);
      sock.emit("typing:stop", {
        sessionId: activeSession.sessionId,
        role: "doctor",
      });
    },
    [input, activeSession]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const sock = socketRef.current;
    if (activeSession && sock) {
      sock.emit("typing:start", {
        sessionId: activeSession.sessionId,
        role: "doctor",
      });
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        sock.emit("typing:stop", {
          sessionId: activeSession.sessionId,
          role: "doctor",
        });
      }, 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addNote = (text: string) => {
    const note: SessionNote = {
      id: `note_${Date.now()}`,
      text,
      createdAt: new Date().toISOString(),
    };
    setActiveSession((prev) =>
      prev ? { ...prev, notes: [...prev.notes, note] } : prev
    );
  };

  const deleteNote = (id: string) => {
    setActiveSession((prev) =>
      prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== id) } : prev
    );
  };

  const endSession = () => {
    if (!activeSession) return;
    setSessionHistory((h) => [{ ...activeSession, status: "ended" }, ...h]);
    setActiveSession(null);
    setSideTab("queue");
  };

  const filteredWaiting = waitingList.filter((s) =>
    s.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* ── Left Sidebar ─────────────────────────────────────────── */}
      <div
        style={{
          width: "290px",
          minWidth: "290px",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "rgba(255,255,255,0.02)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Doctor header */}
        <div
          style={{
            padding: "18px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background:
              "linear-gradient(180deg, rgba(52,211,153,0.07) 0%, transparent 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.15))",
                border: "1.5px solid rgba(52,211,153,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(52,211,153,0.15)",
              }}
            >
              <Stethoscope size={18} color="#34d399" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  color: "#f8f4ff",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {doctorName}
              </p>
              <div
                style={{ display: "flex", alignItems: "center", gap: "5px" }}
              >
                <span
                  className="status-dot"
                  style={{
                    background: isConnected ? "#34d399" : "#6b7280",
                    boxShadow: isConnected
                      ? "0 0 8px rgba(52,211,153,0.6)"
                      : "none",
                  }}
                />
                <span style={{ fontSize: "0.7rem", color: "#7c6a9e" }}>
                  {isConnected ? "Online" : "Reconnecting…"}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              marginBottom: "12px",
            }}
          >
            {[
              { label: "Waiting", value: waitingList.length, color: "#f59e0b" },
              { label: "Sessions", value: totalSessions, color: "#34d399" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    color: s.color,
                    margin: 0,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </p>
                <p
                  style={{
                    fontSize: "0.65rem",
                    color: "#7c6a9e",
                    margin: "3px 0 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <button id="doctor-back-home" className="btn btn-ghost btn-sm">
                <ArrowLeft size={13} /> Home
              </button>
            </Link>
            <button
              id="doctor-logout"
              onClick={onLogout}
              className="btn btn-ghost btn-sm"
              style={{
                marginLeft: "auto",
                color: "#fb7185",
                borderColor: "rgba(251,113,133,0.25)",
              }}
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            padding: "8px",
            gap: "4px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {[
            { id: "queue", label: "Queue", icon: <Users size={13} /> },
            { id: "history", label: "History", icon: <Activity size={13} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`doctor-tab-${tab.id}`}
              onClick={() => setSideTab(tab.id as "queue" | "history" | "notes")}
              style={{
                flex: 1,
                padding: "7px 8px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                transition: "all 0.2s",
                background:
                  sideTab === tab.id
                    ? "rgba(52,211,153,0.15)"
                    : "transparent",
                color: sideTab === tab.id ? "#34d399" : "#7c6a9e",
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "queue" && waitingList.length > 0 && (
                <span
                  style={{
                    background: "#ec4899",
                    color: "white",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "999px",
                  }}
                >
                  {waitingList.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          style={{ flex: 1, overflowY: "auto" }}
          className="scroll-container"
        >
          {sideTab === "queue" && (
            <div style={{ padding: "12px" }}>
              {/* Search */}
              <div style={{ position: "relative", marginBottom: "10px" }}>
                <Search
                  size={13}
                  color="#7c6a9e"
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <input
                  id="doctor-search-patients"
                  type="text"
                  placeholder="Search patients…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input"
                  style={{
                    paddingLeft: "30px",
                    fontSize: "0.8rem",
                    height: "36px",
                  }}
                />
              </div>

              {/* Active session indicator */}
              {activeSession && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "rgba(52,211,153,0.08)",
                    border: "1px solid rgba(52,211,153,0.2)",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    className="status-dot status-online"
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#34d399",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {activeSession.patientName}
                    </p>
                    <p
                      style={{
                        fontSize: "0.68rem",
                        color: "#7c6a9e",
                        margin: 0,
                      }}
                    >
                      Active •{" "}
                      {activeSession.messageCount} msg
                      {activeSession.messageCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className="badge badge-green"
                    style={{ fontSize: "0.6rem" }}
                  >
                    Live
                  </span>
                </div>
              )}

              {/* Waiting list */}
              <p
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: "#7c6a9e",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "8px",
                }}
              >
                Waiting ({filteredWaiting.length})
              </p>

              {filteredWaiting.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "28px 12px",
                    color: "#7c6a9e",
                  }}
                >
                  <p style={{ fontSize: "22px", marginBottom: "6px" }}>✨</p>
                  <p style={{ fontSize: "0.8rem" }}>
                    {searchQuery ? "No patients match" : "No patients waiting"}
                  </p>
                  {!searchQuery && (
                    <p
                      style={{
                        fontSize: "0.7rem",
                        marginTop: "4px",
                        color: "#4a3a6e",
                      }}
                    >
                      You'll be notified automatically
                    </p>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {filteredWaiting.map((session) => (
                    <div
                      key={session.sessionId}
                      className="glass-card fade-in"
                      style={{ padding: "12px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px",
                        }}
                      >
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            flexShrink: 0,
                          }}
                        >
                          👤
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontWeight: 600,
                              fontSize: "0.82rem",
                              color: "#f8f4ff",
                              margin: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {session.patientName}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "3px",
                              marginTop: "2px",
                            }}
                          >
                            <Clock size={10} color="#7c6a9e" />
                            <span style={{ fontSize: "0.65rem", color: "#7c6a9e" }}>
                              {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        id={`accept-patient-${session.sessionId.slice(0, 8)}`}
                        onClick={() => acceptPatient(session.sessionId)}
                        disabled={activeSession?.status === "active" && activeSession.status === "active"}
                        className="btn btn-sm"
                        style={{
                          width: "100%",
                          background:
                            "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.1))",
                          border: "1px solid rgba(52,211,153,0.3)",
                          color: "#34d399",
                          justifyContent: "center",
                          height: "32px",
                          fontSize: "0.78rem",
                        }}
                      >
                        <UserCheck size={12} /> Accept
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sideTab === "history" && (
            <div style={{ padding: "12px" }}>
              <p
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: "#7c6a9e",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "10px",
                }}
              >
                Past Sessions ({sessionHistory.length})
              </p>
              {sessionHistory.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "28px 12px",
                    color: "#7c6a9e",
                    fontSize: "0.8rem",
                  }}
                >
                  <Activity
                    size={24}
                    style={{
                      margin: "0 auto 8px",
                      opacity: 0.3,
                      display: "block",
                    }}
                  />
                  No completed sessions yet
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {sessionHistory.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <p
                          style={{
                            fontWeight: 600,
                            fontSize: "0.8rem",
                            color: "#f8f4ff",
                            margin: 0,
                          }}
                        >
                          {s.patientName}
                        </p>
                        <span
                          className="badge"
                          style={{
                            fontSize: "0.6rem",
                            background: "rgba(107,114,128,0.15)",
                            color: "#9ca3af",
                            border: "1px solid rgba(107,114,128,0.2)",
                          }}
                        >
                          Ended
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "4px",
                        }}
                      >
                        <span
                          style={{ fontSize: "0.68rem", color: "#7c6a9e" }}
                        >
                          <Hash size={10} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                          {s.messageCount} messages
                        </span>
                        <span
                          style={{ fontSize: "0.68rem", color: "#7c6a9e" }}
                        >
                          <Clock size={10} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                          {format(new Date(s.createdAt), "h:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ────────────────────────────────────────── */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
      >
        {!activeSession ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              color: "#7c6a9e",
              textAlign: "center",
              padding: "40px",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.08))",
                border: "1.5px solid rgba(52,211,153,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 40px rgba(52,211,153,0.1)",
              }}
            >
              <Stethoscope size={34} color="rgba(52,211,153,0.6)" />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 700,
                  color: "#c4b5e0",
                  margin: "0 0 8px",
                }}
              >
                Ready to Consult
              </h2>
              <p
                style={{
                  fontSize: "0.875rem",
                  maxWidth: "360px",
                  lineHeight: 1.6,
                }}
              >
                Accept a patient from the waiting queue to begin a live consultation. You'll be notified automatically when a new patient requests help.
              </p>
            </div>
            {waitingList.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  justifyContent: "center",
                }}
              >
                {waitingList.slice(0, 3).map((s) => (
                  <button
                    key={s.sessionId}
                    onClick={() => acceptPatient(s.sessionId)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      borderColor: "rgba(52,211,153,0.3)",
                      color: "#34d399",
                    }}
                  >
                    <UserCheck size={13} /> {s.patientName}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background:
                  "linear-gradient(180deg, rgba(52,211,153,0.05) 0%, transparent 100%)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  border: "1.5px solid rgba(139,92,246,0.25)",
                  flexShrink: 0,
                }}
              >
                👤
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      color: "#f8f4ff",
                      margin: 0,
                    }}
                  >
                    {activeSession.patientName}
                  </p>
                  {activeSession.status === "ended" ? (
                    <span className="badge" style={{ fontSize: "0.65rem", background: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.2)" }}>
                      Session Ended
                    </span>
                  ) : (
                    <span className="badge badge-green" style={{ fontSize: "0.65rem" }}>
                      <span className="status-dot status-online" style={{ width: "6px", height: "6px" }} />
                      Live
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginTop: "2px",
                  }}
                >
                  <span style={{ fontSize: "0.72rem", color: "#7c6a9e" }}>
                    <MessageSquare size={11} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                    {activeSession.messageCount} messages
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#7c6a9e" }}>
                    <Clock size={11} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                    Started {format(new Date(activeSession.createdAt), "h:mm a")}
                  </span>
                  {patientTyping && (
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "#34d399",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span
                        className="typing-dots"
                        style={{ display: "inline-flex", gap: "2px" }}
                      >
                        <span
                          className="typing-dot"
                          style={{ width: "5px", height: "5px", background: "#34d399" }}
                        />
                        <span
                          className="typing-dot"
                          style={{ width: "5px", height: "5px", background: "#34d399", animationDelay: "0.2s" }}
                        />
                        <span
                          className="typing-dot"
                          style={{ width: "5px", height: "5px", background: "#34d399", animationDelay: "0.4s" }}
                        />
                      </span>
                      typing
                    </span>
                  )}
                </div>
              </div>

              {/* Header actions */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  id="doctor-session-history-tab"
                  onClick={() => setSideTab("history")}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.75rem" }}
                  title="View conversation history"
                >
                  <Activity size={13} /> History
                </button>
                <button
                  id="doctor-session-notes-tab"
                  onClick={() => setSideTab("notes")}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.75rem" }}
                  title="Session notes"
                >
                  <FileText size={13} />
                  Notes
                  {activeSession.notes.length > 0 && (
                    <span
                      style={{
                        background: "#f59e0b",
                        color: "#000",
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: "999px",
                      }}
                    >
                      {activeSession.notes.length}
                    </span>
                  )}
                </button>
                {activeSession.status === "active" && (
                  <button
                    id="doctor-end-session"
                    onClick={endSession}
                    className="btn btn-ghost btn-sm"
                    style={{
                      color: "#fb7185",
                      borderColor: "rgba(251,113,133,0.2)",
                      fontSize: "0.75rem",
                    }}
                    title="End session"
                  >
                    <X size={13} /> End
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div
              className="scroll-container"
              style={{
                flex: 1,
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                overflowY: "auto",
              }}
            >
              {/* Session start marker */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  margin: "4px 0 8px",
                }}
              >
                <div
                  style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }}
                />
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "#7c6a9e",
                    whiteSpace: "nowrap",
                  }}
                >
                  Session started · {format(new Date(activeSession.createdAt), "h:mm a · MMM d")}
                </span>
                <div
                  style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }}
                />
              </div>

              {activeSession.messages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div
                      key={msg.id}
                      style={{
                        textAlign: "center",
                        padding: "6px 12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#7c6a9e",
                          background: "rgba(255,255,255,0.04)",
                          padding: "4px 12px",
                          borderRadius: "999px",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                const isDoctor = msg.role === "doctor";
                return (
                  <div
                    key={msg.id}
                    className="message-enter"
                    style={{
                      display: "flex",
                      justifyContent: isDoctor ? "flex-end" : "flex-start",
                      gap: "8px",
                      alignItems: "flex-end",
                    }}
                  >
                    {!isDoctor && (
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "13px",
                          flexShrink: 0,
                        }}
                      >
                        👤
                      </div>
                    )}
                    <div style={{ maxWidth: "68%" }}>
                      <div
                        style={{
                          padding: "11px 15px",
                          borderRadius: isDoctor
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                          background: isDoctor
                            ? "linear-gradient(135deg, #059669, #047857)"
                            : "rgba(255,255,255,0.05)",
                          border: isDoctor
                            ? "none"
                            : "1px solid rgba(255,255,255,0.08)",
                          color: "#f8f4ff",
                          fontSize: "0.88rem",
                          lineHeight: 1.6,
                          boxShadow: isDoctor
                            ? "0 4px 16px rgba(5,150,105,0.25)"
                            : "none",
                        }}
                      >
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                          {msg.content}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "4px",
                          justifyContent: isDoctor ? "flex-end" : "flex-start",
                          padding: "0 2px",
                        }}
                      >
                        <span
                          style={{ fontSize: "0.65rem", color: "#7c6a9e" }}
                        >
                          {format(new Date(msg.timestamp), "h:mm a")}
                        </span>
                        {isDoctor && (
                          <CheckCheck size={12} color="#34d399" />
                        )}
                      </div>
                    </div>
                    {isDoctor && (
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.15))",
                          border: "1px solid rgba(52,211,153,0.3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Stethoscope size={13} color="#34d399" />
                      </div>
                    )}
                  </div>
                );
              })}

              {patientTyping && (
                <div
                  className="message-enter"
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      flexShrink: 0,
                    }}
                  >
                    👤
                  </div>
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: "18px 18px 18px 4px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
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

            {/* Input area */}
            {activeSession.status === "active" && (
              <div
                style={{
                  padding: "12px 16px 16px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  background:
                    "linear-gradient(180deg, transparent, rgba(0,0,0,0.15))",
                  flexShrink: 0,
                }}
              >
                {/* Quick Replies */}
                {showQuickReplies && (
                  <div
                    style={{
                      marginBottom: "10px",
                      background: "rgba(22,13,46,0.98)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "14px",
                      overflow: "hidden",
                      boxShadow: "0 -8px 30px rgba(0,0,0,0.4)",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Zap size={13} color="#f59e0b" />
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#c4b5e0" }}>
                          Quick Replies
                        </span>
                      </div>
                      <button
                        onClick={() => setShowQuickReplies(false)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#7c6a9e" }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div
                      style={{
                        maxHeight: "180px",
                        overflowY: "auto",
                        padding: "6px",
                      }}
                      className="scroll-container"
                    >
                      {QUICK_REPLIES.map((reply, i) => (
                        <button
                          key={i}
                          id={`quick-reply-${i}`}
                          onClick={() => {
                            setInput(reply);
                            setShowQuickReplies(false);
                            inputRef.current?.focus();
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            fontSize: "0.8rem",
                            color: "#c4b5e0",
                            lineHeight: 1.5,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) =>
                            ((e.target as HTMLElement).style.background =
                              "rgba(255,255,255,0.05)")
                          }
                          onMouseLeave={(e) =>
                            ((e.target as HTMLElement).style.background = "none")
                          }
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-end",
                  }}
                >
                  <button
                    id="doctor-quick-replies-toggle"
                    onClick={() => setShowQuickReplies((v) => !v)}
                    className="btn btn-ghost btn-icon"
                    style={{
                      width: "38px",
                      height: "38px",
                      flexShrink: 0,
                      color: showQuickReplies ? "#f59e0b" : "#7c6a9e",
                      borderColor: showQuickReplies
                        ? "rgba(245,158,11,0.3)"
                        : undefined,
                    }}
                    title="Quick replies"
                    aria-label="Toggle quick replies"
                  >
                    <Zap size={15} />
                  </button>

                  <textarea
                    id="doctor-message-input"
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your response… (Enter to send, Shift+Enter for new line)"
                    rows={1}
                    className="input"
                    style={{
                      flex: 1,
                      resize: "none",
                      maxHeight: "120px",
                      overflowY: "auto",
                      lineHeight: 1.5,
                      fontSize: "0.875rem",
                    }}
                  />

                  <button
                    id="doctor-send-button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    className="btn btn-primary btn-icon"
                    style={{ width: "42px", height: "42px", flexShrink: 0 }}
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </button>
                </div>

                <p
                  style={{
                    fontSize: "0.68rem",
                    color: "#4a3a6e",
                    marginTop: "6px",
                    textAlign: "center",
                  }}
                >
                  Enter to send · Shift+Enter for new line · ⚡ for quick replies
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right Panel: History / Notes ──────────────────────────── */}
      {activeSession && (sideTab === "history" || sideTab === "notes") && (
        <div
          style={{
            width: "280px",
            minWidth: "280px",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            background: "rgba(255,255,255,0.02)",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: "4px" }}>
              {[
                { id: "history", label: "History", icon: <Activity size={12} /> },
                { id: "notes", label: "Notes", icon: <FileText size={12} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  id={`right-panel-tab-${tab.id}`}
                  onClick={() => setSideTab(tab.id as "history" | "notes")}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "7px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.2s",
                    background:
                      sideTab === tab.id
                        ? "rgba(139,92,246,0.15)"
                        : "transparent",
                    color: sideTab === tab.id ? "#a78bfa" : "#7c6a9e",
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              id="close-right-panel"
              onClick={() => setSideTab("queue")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#7c6a9e",
              }}
              aria-label="Close panel"
            >
              <X size={15} />
            </button>
          </div>

          {/* Panel content */}
          <div
            style={{ flex: 1, overflowY: "auto" }}
            className="scroll-container"
          >
            {sideTab === "history" && (
              <HistoryTab
                messages={activeSession.messages}
                patientName={activeSession.patientName}
              />
            )}
            {sideTab === "notes" && (
              <NotesTab
                notes={activeSession.notes}
                onAddNote={addNote}
                onDeleteNote={deleteNote}
              />
            )}
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <Toast message={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DoctorPage() {
  const [doctorName, setDoctorName] = useState<string | null>(null);

  return doctorName ? (
    <Dashboard doctorName={doctorName} onLogout={() => setDoctorName(null)} />
  ) : (
    <LoginGate onLogin={setDoctorName} />
  );
}
