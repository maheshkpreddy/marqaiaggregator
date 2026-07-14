import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Marq AI — Unified AI Aggregator Platform",
  description:
    "Marq AI aggregates OpenAI, Google Gemini, and Anthropic Claude into one unified workspace with automatic failover. Your reliable backup plan for any AI-powered application.",
  keywords: [
    "Marq AI",
    "AI aggregator",
    "unified AI gateway",
    "OpenAI",
    "Gemini",
    "Claude",
    "failover",
    "multi-model",
  ],
  authors: [{ name: "Marq AI" }],
  openGraph: {
    title: "Marq AI — Unified AI Aggregator Platform",
    description: "One workspace. Every model. Automatic failover.",
    siteName: "Marq AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
