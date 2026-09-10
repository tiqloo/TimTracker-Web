import type { MetadataRoute } from "next";

// Ticket 186 (selbst gefunden): fehlte bisher komplett. Nur die
// tatsächlich für organische Auffindbarkeit gedachten öffentlichen
// Seiten — bewusst NICHT `/reset-password` (nur über einen E-Mail-Link
// erreichbar, kein Einstiegspunkt), `/register/company` (hinter Login,
// siehe lib/http/proxy-routing.ts EXTRA_PROTECTED_PATHS) oder
// `/invite/accept` (personalisierter Einladungslink, nichts zum
// Indexieren).
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  return [
    { url: baseUrl, priority: 1 },
    { url: `${baseUrl}/register`, priority: 0.8 },
    { url: `${baseUrl}/login`, priority: 0.5 },
  ];
}
