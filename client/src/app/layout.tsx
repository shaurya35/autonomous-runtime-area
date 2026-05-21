import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-display" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Sentinel",
  description: "Autonomous SRE agent benchmark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}>
      <body style={{ backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)" }}>
        <nav style={{ borderBottom: "1px solid var(--color-border-soft)", padding: "0 1.5rem", height: "3rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <a href="/" style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-primary)", textDecoration: "none" }}>sentinel</a>
          <a href="/" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", textDecoration: "none" }}>dashboard</a>
          <a href="/leaderboard" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", textDecoration: "none" }}>leaderboard</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
