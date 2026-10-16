import type { Metadata, Viewport } from "next";
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

/**
 * Root metadata for the Milan dating app — title, description, theme
 * colour (rose), OpenGraph + Twitter cards, and viewport configuration
 * (mobile-first, safe-area aware, rose theme colour for browser chrome).
 */
export const metadata: Metadata = {
  title: "Milan — AI Dating for Nepal",
  description:
    "Milan is an AI-powered dating app built for Nepal — swipe through a smart, Elo-ranked, content-based + collaborative + multi-armed-bandit recommendation deck. Find your person in Kathmandu, Lalitpur, Bhaktapur and beyond.",
  applicationName: "Milan",
  keywords: [
    "Milan",
    "AI dating",
    "Nepal dating",
    "Kathmandu dating",
    "matching algorithm",
    "recommendation engine",
    "Zustand",
    "Next.js",
  ],
  authors: [{ name: "Milan Team" }],
  creator: "Milan Team",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Milan — AI Dating for Nepal",
    description:
      "Swipe through a smart, Elo-ranked recommendation deck powered by content-based + collaborative filtering + a multi-armed bandit. Made for Nepal.",
    url: "https://milan.app",
    siteName: "Milan",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Milan — AI Dating for Nepal",
    description:
      "AI-powered dating built for Nepal — Elo-ranked, content + collaborative + bandit-driven matching.",
  },
};

export const viewport: Viewport = {
  themeColor: "#e11d48",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
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
