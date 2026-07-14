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
  title: "Gemini Chat — Streaming Next.js demo",
  description:
    "A streaming chat UI built on Next.js 16 and the Google Gemini API. API key stays server-side; runs on Vercel iad1.",
  keywords: [
    "Gemini",
    "Google AI",
    "Next.js",
    "streaming chat",
    "Vercel",
    "App Router",
  ],
  authors: [{ name: "Gemini Chat" }],
  openGraph: {
    title: "Gemini Chat — Streaming Next.js demo",
    description: "Server-side key. Streaming responses. Vercel-ready.",
    siteName: "Gemini Chat",
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
