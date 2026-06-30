"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble, { Message } from "./MessageBubble";

interface ChatWindowProps {
  messages: Message[];
  isTyping: boolean;
  isDoctorTyping?: boolean;
}

export default function ChatWindow({ messages, isTyping, isDoctorTyping }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, isDoctorTyping]);

  // Show scroll-to-bottom button when not near bottom
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBtn(!nearBottom);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      {/* Message list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="scroll-container"
        style={{
          height: "100%",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div
            className="fade-in"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              padding: "40px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2))",
                border: "1px solid rgba(139,92,246,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
              }}
            >
              🌸
            </div>
            <div>
              <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "#f8f4ff", marginBottom: "8px" }}>
                Hello! I'm Fille AI
              </p>
              <p style={{ fontSize: "0.9rem", color: "#7c6a9e", maxWidth: "340px", lineHeight: 1.6 }}>
                Your compassionate women's health assistant. Ask me anything about reproductive health, menstrual wellness, hormones, nutrition, and more.
              </p>
            </div>

            {/* Suggestion chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "8px" }}>
              {[
                "What are normal menstrual cycle lengths?",
                "Tips for managing PCOS symptoms",
                "Signs of hormonal imbalance",
                "Pregnancy nutrition advice",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => {
                    // Dispatch a custom event that the parent can listen to
                    window.dispatchEvent(new CustomEvent("suggestion-click", { detail: suggestion }));
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* AI typing indicator */}
        {isTyping && (
          <div
            className="message-enter"
            style={{ display: "flex", alignItems: "flex-end", gap: "10px", marginBottom: "16px" }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1e1040, #271552)",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
              }}
            >
              🌸
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "18px 18px 18px 4px",
                padding: "14px 18px",
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

        {/* Doctor typing indicator */}
        {isDoctorTyping && (
          <div
            className="message-enter"
            style={{ display: "flex", alignItems: "flex-end", gap: "10px", marginBottom: "16px" }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(52,211,153,0.3), rgba(16,185,129,0.3))",
                border: "1px solid rgba(52,211,153,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
              }}
            >
              🩺
            </div>
            <div
              style={{
                background: "rgba(52,211,153,0.08)",
                border: "1px solid rgba(52,211,153,0.2)",
                borderRadius: "18px 18px 18px 4px",
                padding: "14px 18px",
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

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="btn btn-ghost btn-sm"
          style={{
            position: "absolute",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            zIndex: 10,
            backdropFilter: "blur(10px)",
          }}
          aria-label="Scroll to bottom"
        >
          ↓ New messages
        </button>
      )}
    </div>
  );
}
