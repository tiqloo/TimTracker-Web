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

export const metadata: Metadata = {
  title: "TimTracker — Zeit erfassen, ohne daran zu denken",
  description:
    "TimTracker erfasst deine Arbeitszeit automatisch im Hintergrund (Login, Wake, Sleep, Bildschirmsperre) und lässt dich Zeit im Nachhinein Projekten zuordnen — als Menüleisten-App und im Web-Dashboard.",
};

// The one place the language preference (Ticket 018, Phase 1e —
// app/(dashboard)/settings) has a REAL, site-wide effect: the actual
// <html lang> attribute, for every route (auth pages included, since the
// preference is a plain cookie with no login requirement to read). This
// deliberately does NOT translate any UI text — see
// lib/domain/language.ts's SCOPE NOTE for why that's a separate,
// out-of-scope undertaking for this phase.
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
