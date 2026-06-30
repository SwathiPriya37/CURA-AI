"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { Bot, User, Stethoscope } from "lucide-react";

export type MessageRole = "user" | "assistant" | "doctor" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  contextUsed?: boolean;
}

interface MessageBubbleProps {
  message: Message;
}

const roleConfig: Record<MessageRole, { label: string; Icon: React.ElementType; colorClass: string; bubbleStyle: React.CSSProperties; iconBg: string }> = {
  user: {
    label: "You",
    Icon: User,
    colorClass: "",
    bubbleStyle: {
      background: "linear-gradient(135deg, #7c3aed, #db2777)",
      borderRadius: "18px 18px 4px 18px",
      color: "#fff",
    },
    iconBg: "linear-gradient(135deg, #7c3aed, #db2777)",
  },
  assistant: {
    label: "Fille AI",
    Icon: Bot,
    colorClass: "prose",
    bubbleStyle: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "18px 18px 18px 4px",
      color: "#f8f4ff",
    },
    iconBg: "linear-gradient(135deg, #1e1040, #271552)",
  },
  doctor: {
    label: "Doctor",
    Icon: Stethoscope,
    colorClass: "prose",
    bubbleStyle: {
      background: "rgba(52,211,153,0.08)",
      border: "1px solid rgba(52,211,153,0.2)",
      borderRadius: "18px 18px 18px 4px",
      color: "#f8f4ff",
    },
    iconBg: "linear-gradient(135deg, rgba(52,211,153,0.3), rgba(16,185,129,0.3))",
  },
  system: {
    label: "System",
    Icon: Bot,
    colorClass: "",
    bubbleStyle: {
      background: "rgba(139,92,246,0.08)",
      border: "1px solid rgba(139,92,246,0.2)",
      borderRadius: "12px",
      color: "#c4b5e0",
    },
    iconBg: "transparent",
  },
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { role, content, timestamp, contextUsed } = message;
  const config = roleConfig[role];
  const isUser = role === "user";
  const isSystem = role === "system";

  if (isSystem) {
    return (
      <div
        className="message-enter"
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "12px",
        }}
      >
        <div style={{ ...config.bubbleStyle, padding: "8px 16px", fontSize: "0.8rem", maxWidth: "80%", textAlign: "center" }}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className="message-enter"
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: "10px",
        marginBottom: "16px",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: config.iconBg,
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <config.Icon size={16} color={isUser ? "#fff" : role === "doctor" ? "#34d399" : "#a78bfa"} />
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: "72%", minWidth: "60px" }}>
        {/* Label + time */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
            flexDirection: isUser ? "row-reverse" : "row",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: isUser ? "#c4b5e0" : role === "doctor" ? "#34d399" : "#a78bfa" }}>
            {config.label}
          </span>
          <span style={{ fontSize: "0.7rem", color: "#7c6a9e" }}>
            {format(timestamp, "h:mm a")}
          </span>
          {contextUsed && !isUser && (
            <span
              style={{
                fontSize: "0.65rem",
                background: "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.25)",
                color: "#a78bfa",
                padding: "1px 7px",
                borderRadius: "999px",
              }}
            >
              KB
            </span>
          )}
        </div>

        {/* Content */}
        <div style={{ ...config.bubbleStyle, padding: "12px 16px", lineHeight: 1.7, fontSize: "0.9375rem" }}>
          {isUser ? (
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{content}</p>
          ) : (
            <div className={config.colorClass}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
