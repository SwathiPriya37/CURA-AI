"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { Send, X, Stethoscope, Phone, PhoneOff } from "lucide-react";
import { format } from "date-fns";

interface DoctorMessage {
  id: string;
  content: string;
  role: "patient" | "doctor";
  timestamp: string;
}

interface DoctorChatProps {
  sessionId: string;
  patientName: string;
  onClose: () => void;
}

export default function DoctorChat({ sessionId, patientName, onClose }: DoctorChatProps) {
  const [messages, setMessages] = useState<DoctorMessage[]>([]);
  const [input, setInput] = useState("");
  const [doctorJoined, setDoctorJoined] = useState(false);
  const [isDoctorTyping, setIsDoctorTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const socket = getSocket();

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("patient:join", { sessionId, patientName });

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("session:created", ({ sessionId: sid }: { sessionId: string }) => {
      setIsConnected(true);
      addSystemMsg(`Session started (ID: ${sid.slice(0, 8)}…). Connecting you with a doctor…`);
    });

    socket.on("doctor:joined", ({ message }: { message: string }) => {
      setDoctorJoined(true);
      addSystemMsg(message);
    });

    socket.on("doctor:left", ({ message }: { message: string }) => {
      setDoctorJoined(false);
      addSystemMsg(message);
    });

    socket.on("message:received", (msg: DoctorMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("typing:start", ({ role }: { role: string }) => {
      if (role === "doctor") setIsDoctorTyping(true);
    });

    socket.on("typing:stop", ({ role }: { role: string }) => {
      if (role === "doctor") setIsDoctorTyping(false);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("session:created");
      socket.off("doctor:joined");
      socket.off("doctor:left");
      socket.off("message:received");
      socket.off("typing:start");
      socket.off("typing:stop");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isDoctorTyping]);

  const addSystemMsg = (content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `sys_${Date.now()}`, content, role: "doctor", timestamp: new Date().toISOString() },
    ]);
  };

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !sessionId) return;

    socket.emit("message:send", { sessionId, content: text, role: "patient" });
    setInput("");

    // Stop typing indicator
    socket.emit("typing:stop", { sessionId, role: "patient" });
  }, [input, sessionId, socket]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    socket.emit("typing:start", { sessionId, role: "patient" });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing:stop", { sessionId, role: "patient" });
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        width: "380px",
        height: "520px",
        display: "flex",
        flexDirection: "column",
        borderRadius: "20px",
        overflow: "hidden",
        background: "rgba(22,13,46,0.97)",
        border: "1px solid rgba(52,211,153,0.25)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 30px rgba(52,211,153,0.1)",
        backdropFilter: "blur(20px)",
        zIndex: 1000,
        animation: "fadeIn 0.3s ease both",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.1))",
          borderBottom: "1px solid rgba(52,211,153,0.2)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(52,211,153,0.3), rgba(16,185,129,0.2))",
            border: "1px solid rgba(52,211,153,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Stethoscope size={18} color="#34d399" />
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#f8f4ff", margin: 0 }}>Doctor Chat</p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
            <span
              className="status-dot"
              style={{ background: doctorJoined ? "#34d399" : isConnected ? "#f59e0b" : "#6b7280" }}
            />
            <span style={{ fontSize: "0.75rem", color: "#7c6a9e" }}>
              {doctorJoined ? "Doctor connected" : isConnected ? "Waiting for doctor…" : "Connecting…"}
            </span>
          </div>
        </div>

        <button
          id="doctor-chat-close"
          onClick={onClose}
          className="btn btn-ghost btn-icon btn-sm"
          aria-label="Close doctor chat"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div
        className="scroll-container"
        style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}
      >
        {messages.map((msg) => {
          const isPatient = msg.role === "patient";
          return (
            <div
              key={msg.id}
              className="message-enter"
              style={{ display: "flex", justifyContent: isPatient ? "flex-end" : "flex-start" }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: isPatient ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isPatient
                    ? "linear-gradient(135deg, #7c3aed, #db2777)"
                    : "rgba(52,211,153,0.1)",
                  border: isPatient ? "none" : "1px solid rgba(52,211,153,0.2)",
                  color: "#f8f4ff",
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                }}
              >
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.7rem", color: isPatient ? "rgba(255,255,255,0.6)" : "#7c6a9e", textAlign: "right" }}>
                  {format(new Date(msg.timestamp), "h:mm a")}
                </p>
              </div>
            </div>
          );
        })}

        {/* Doctor typing */}
        {isDoctorTyping && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "16px 16px 16px 4px",
                background: "rgba(52,211,153,0.08)",
                border: "1px solid rgba(52,211,153,0.15)",
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

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(52,211,153,0.15)",
          display: "flex",
          gap: "8px",
          alignItems: "flex-end",
        }}
      >
        <textarea
          id="doctor-chat-input"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={doctorJoined ? "Message the doctor…" : "Waiting for doctor to connect…"}
          disabled={!doctorJoined}
          rows={1}
          className="input"
          style={{
            flex: 1,
            minHeight: "40px",
            maxHeight: "100px",
            padding: "10px 14px",
            fontSize: "0.875rem",
            resize: "none",
            overflowY: "auto",
          }}
        />
        <button
          id="doctor-chat-send"
          onClick={sendMessage}
          disabled={!doctorJoined || !input.trim()}
          className="btn btn-primary btn-icon"
          aria-label="Send message to doctor"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
