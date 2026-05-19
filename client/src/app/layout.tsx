import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-display" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Sentinel Ward",
  description: "Autonomous SRE incident response",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}>
      <body style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)" }}>
        <nav style={{ borderBottom: "1px solid var(--color-border-soft)", padding: "0 1.5rem", height: "3rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--color-doctor)" }}>Sentinel Ward</span>
          <a href="/" style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>Ward</a>
          <a href="/leaderboard" style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>Leaderboard</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
