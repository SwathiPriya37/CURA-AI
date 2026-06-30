"use client";

import { Bot, Stethoscope, Heart, Shield, MessageCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

interface SidebarProps {
  onNewChat: () => void;
  chatCount: number;
  backendStatus: "online" | "offline" | "loading";
}

const HEALTH_TOPICS = [
  { emoji: "🌸", label: "Menstrual Health" },
  { emoji: "🤰", label: "Pregnancy & Fertility" },
  { emoji: "⚖️", label: "Hormonal Balance" },
  { emoji: "🧬", label: "Reproductive Health" },
  { emoji: "🧠", label: "Mental Wellness" },
  { emoji: "🥗", label: "Nutrition & Diet" },
  { emoji: "💊", label: "Medications & Supplements" },
  { emoji: "🌡️", label: "Menopause" },
];

export default function Sidebar({ onNewChat, chatCount, backendStatus }: SidebarProps) {
  return (
    <aside
      style={{
        width: "260px",
        minWidth: "260px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.03)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        padding: "0",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              boxShadow: "0 0 20px rgba(139,92,246,0.4)",
            }}
          >
            🌸
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: "1.1rem", background: "linear-gradient(135deg, #ec4899, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Fille AI
            </p>
            <p style={{ fontSize: "0.7rem", color: "#7c6a9e", marginTop: "-2px" }}>Women's Health Assistant</p>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          id="sidebar-new-chat"
          onClick={onNewChat}
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
        >
          <MessageCircle size={16} />
          New Conversation
        </button>
      </div>

      <div className="divider" style={{ margin: "0 20px" }} />

      {/* Health Topics */}
      <div style={{ padding: "16px 12px", flex: 1 }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#7c6a9e", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 8px", marginBottom: "8px" }}>
          Health Topics
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {HEALTH_TOPICS.map(({ emoji, label }) => (
            <button
              key={label}
              className="btn btn-ghost btn-sm"
              style={{
                justifyContent: "flex-start",
                borderRadius: "10px",
                padding: "8px 12px",
                gap: "10px",
                border: "none",
                width: "100%",
                textAlign: "left",
              }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent("suggestion-click", { detail: `Tell me about ${label.toLowerCase()}` }));
              }}
            >
              <span style={{ fontSize: "16px" }}>{emoji}</span>
              <span style={{ fontSize: "0.8rem", color: "#c4b5e0" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="divider" style={{ margin: "0 20px" }} />

      {/* Doctor Dashboard Link */}
      <div style={{ padding: "16px 12px" }}>
        <Link
          href="/doctor"
          style={{ textDecoration: "none" }}
          id="sidebar-doctor-dashboard"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px",
              borderRadius: "12px",
              background: "rgba(52,211,153,0.07)",
              border: "1px solid rgba(52,211,153,0.15)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.07)";
            }}
          >
            <Stethoscope size={16} color="#34d399" />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#34d399", margin: 0 }}>Doctor Portal</p>
              <p style={{ fontSize: "0.7rem", color: "#7c6a9e", margin: 0 }}>For certified doctors</p>
            </div>
            <ChevronRight size={14} color="#7c6a9e" />
          </div>
        </Link>
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: "12px 20px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.72rem", color: "#7c6a9e" }}>AI Backend</span>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span
                className="status-dot"
                style={{
                  background: backendStatus === "online" ? "#34d399" : backendStatus === "loading" ? "#f59e0b" : "#f87171",
                  boxShadow: backendStatus === "online" ? "0 0 8px rgba(52,211,153,0.6)" : "none",
                }}
              />
              <span style={{ fontSize: "0.72rem", color: backendStatus === "online" ? "#34d399" : "#7c6a9e" }}>
                {backendStatus === "online" ? "Online" : backendStatus === "loading" ? "Connecting…" : "Offline"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <Shield size={11} color="#7c6a9e" />
            <span style={{ fontSize: "0.7rem", color: "#7c6a9e" }}>Not a substitute for medical advice</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
