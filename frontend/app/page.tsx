"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Send, Stethoscope, AlertTriangle, X, Sparkles } from "lucide-react";
import ChatWindow from "@/components/ChatWindow";
import Sidebar from "@/components/Sidebar";
import DoctorChat from "@/components/DoctorChat";
import { Message } from "@/components/MessageBubble";
import { sendChatMessage, checkHealth } from "@/lib/api";

let msgCounter = 0;
function newId() { return `msg_${++msgCounter}_${Date.now()}`; }

type BackendStatus = "online" | "offline" | "loading";

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("loading");
  const [showEscalationBanner, setShowEscalationBanner] = useState(false);
  const [showDoctorChat, setShowDoctorChat] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [patientName] = useState("Patient");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Health-check on mount
  useEffect(() => {
    (async () => {
      const ok = await checkHealth();
      setBackendStatus(ok ? "online" : "offline");
    })();
  }, []);

  // Listen for suggestion-chip clicks from child components
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      setInput(text);
      textareaRef.current?.focus();
    };
    window.addEventListener("suggestion-click", handler);
    return () => window.removeEventListener("suggestion-click", handler);
  }, []);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const addMessage = useCallback((role: Message["role"], content: string, contextUsed?: boolean): Message => {
    const msg: Message = { id: newId(), role, content, timestamp: new Date(), contextUsed };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    addMessage("user", text);
    setIsTyping(true);

    try {
      const result = await sendChatMessage(text);

      addMessage("assistant", result.response, result.context_used);

      if (result.escalate) {
        setShowEscalationBanner(true);
      }
    } catch (err) {
      addMessage("system", "⚠️ Unable to reach the AI backend. Please ensure the FastAPI server is running on port 8000.");
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setShowEscalationBanner(false);
    setShowDoctorChat(false);
  };

  const handleConnectDoctor = () => {
    setShowEscalationBanner(false);
    setShowDoctorChat(true);
    addMessage("system", "🩺 Connecting you with a certified doctor. Please wait a moment…");
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <Sidebar onNewChat={handleNewChat} chatCount={messages.length} backendStatus={backendStatus} />

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

        {/* Top bar */}
        <header
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)",
            backdropFilter: "blur(10px)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Sparkles size={18} color="#8b5cf6" />
            <div>
              <h1 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f8f4ff", margin: 0 }}>
                Women's Health Chat
              </h1>
              <p style={{ fontSize: "0.72rem", color: "#7c6a9e", margin: 0 }}>
                Powered by Gemini AI + Semantic Search
              </p>
            </div>
          </div>

          <button
            id="header-talk-to-doctor"
            onClick={handleConnectDoctor}
            className="btn btn-ghost btn-sm"
            style={{
              borderColor: "rgba(52,211,153,0.3)",
              color: "#34d399",
            }}
          >
            <Stethoscope size={15} />
            Talk to a Doctor
          </button>
        </header>

        {/* Escalation Banner */}
        {showEscalationBanner && (
          <div
            className="fade-in"
            style={{
              margin: "12px 16px 0",
              padding: "14px 18px",
              borderRadius: "14px",
              background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.3)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <AlertTriangle size={18} color="#fb7185" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fb7185", margin: 0 }}>
                Professional guidance recommended
              </p>
              <p style={{ fontSize: "0.78rem", color: "#c4b5e0", margin: "2px 0 0" }}>
                Based on your symptoms, speaking with a certified doctor is advised.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button
                id="escalation-connect-doctor"
                onClick={handleConnectDoctor}
                className="btn btn-sm"
                style={{
                  background: "linear-gradient(135deg, rgba(52,211,153,0.3), rgba(16,185,129,0.2))",
                  border: "1px solid rgba(52,211,153,0.4)",
                  color: "#34d399",
                  fontWeight: 600,
                }}
              >
                <Stethoscope size={13} /> Connect Now
              </button>
              <button
                id="escalation-dismiss"
                onClick={() => setShowEscalationBanner(false)}
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Chat Window */}
        <ChatWindow messages={messages} isTyping={isTyping} />

        {/* Input Area */}
        <div
          style={{
            padding: "16px 20px 20px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.02)",
            backdropFilter: "blur(10px)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "18px",
              padding: "10px 14px",
              transition: "border-color 0.2s",
            }}
            onFocus={() => {}}
          >
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about women's health… (Shift+Enter for new line)"
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#f8f4ff",
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.9375rem",
                lineHeight: 1.6,
                resize: "none",
                maxHeight: "160px",
                overflowY: "auto",
              }}
            />
            <button
              id="chat-send-button"
              onClick={sendMessage}
              disabled={!input.trim() || isTyping}
              className="btn btn-primary btn-icon"
              style={{ flexShrink: 0 }}
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: "0.7rem", color: "#4a3a6e", marginTop: "10px" }}>
            Fille AI provides general health information only. Always consult a qualified healthcare provider for medical decisions.
          </p>
        </div>
      </div>

      {/* Doctor Chat Panel */}
      {showDoctorChat && (
        <DoctorChat
          sessionId={sessionId}
          patientName={patientName}
          onClose={() => setShowDoctorChat(false)}
        />
      )}
    </div>
  );
}
