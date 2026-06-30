import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CURA AI — Women's Health Assistant",
  description:
    "CURA AI is an AI-powered women's health chatbot providing clear, factual, and supportive health guidance with seamless access to certified doctors.",
  keywords: ["women's health", "AI chatbot", "health assistant", "doctor chat", "CURA AI"],
  authors: [{ name: "CURA AI" }],
  openGraph: {
    title: "CURA AI — Women's Health Assistant",
    description: "AI-powered women's health chatbot with real-time doctor support.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f0a1e" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌸</text></svg>" />
      </head>
      <body>
        {/* Ambient background orbs */}
        <div className="bg-orbs" aria-hidden="true">
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
