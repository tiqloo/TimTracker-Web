import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const METADATA_BY_LANG = {
  de: {
    title: "TimTracker — Zeit erfassen, ohne daran zu denken",
    description:
      "TimTracker erfasst deine Arbeitszeit automatisch im Hintergrund (Login, Wake, Sleep, Bildschirmsperre) und lässt dich Zeit im Nachhinein Projekten zuordnen — als Menüleisten-App und im Web-Dashboard.",
  },
  en: {
    title: "TimTracker — Time Tracking Without Thinking About It",
    description:
      "TimTracker tracks your work time automatically in the background (login, wake, sleep, screen lock) and lets you assign time to projects afterwards — as a menu-bar app and in the web dashboard.",
  },
} as const;

// Resolved the same getEffectiveLanguageCode() way as <html lang> below
// (Ticket 022) — the browser-tab title and any social-preview description
// are visible UI text too, so they follow the language preference like
// everything else now does, not just the page body.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return METADATA_BY_LANG[lang];
}

// The one place the language preference (Ticket 018, Phase 1e —
// app/(dashboard)/settings) has a REAL, site-wide effect: the actual
// <html lang> attribute, for every route (auth pages included, since the
// preference is a plain cookie with no login requirement to read). As of
// Ticket 022, every page's own UI text also follows this same preference
// — this layout itself still only owns <html lang> and the metadata
// above; the actual body text translation happens per-page (see
// lib/i18n.ts).
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
