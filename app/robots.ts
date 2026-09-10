import type { MetadataRoute } from "next";

// Ticket 186 (selbst gefunden): fehlte bisher komplett — kein
// robots.txt bedeutet Suchmaschinen-Standardverhalten (alles crawlbar,
// kein Sitemap-Hinweis), nicht falsch, aber für eine echte
// Produktions-Domain (tiqloo.com) unvollständig. `/dashboard` explizit
// ausgeschlossen: hinter Login, ein Crawler landet ohnehin nur auf
// `/login` (proxy.ts), aber explizit ist besser als implizit.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/auth/callback", "/auth/desktop-complete"],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
