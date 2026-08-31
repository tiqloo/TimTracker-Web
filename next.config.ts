import type { NextConfig } from "next";

// Ticket 027 (TimTracker-Starter/docs/tickets/027-web-security-headers.md):
// baseline security headers for a site handling login sessions and Stripe
// billing, previously entirely absent (this file was a stub with no
// headers() at all).
//
// This file owns the headers that are the SAME for every request —
// Content-Security-Policy is deliberately NOT here. It needs a fresh
// per-request nonce (Next.js's own RSC-hydration bootstrap scripts need
// one to run under a CSP with no 'unsafe-inline' — confirmed by actually
// loading pages in a browser, see proxy.ts for the full story and why a
// static header here can't do it), so it's built in proxy.ts
// (middleware) instead. next.config.ts's headers() below still applies
// on top of whatever proxy.ts returns — verified via `curl -I` that all
// headers from both places show up together, including on proxy.ts's own
// redirect responses.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Only meaningful because Vercel already terminates/enforces HTTPS for
  // every request — still sent explicitly so browsers upgrade and pin
  // future requests to this host themselves, independent of Vercel's own
  // redirect behavior.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Equivalent to the CSP's frame-ancestors 'none' (proxy.ts), kept
  // alongside it for browsers that only honor one or the other — this
  // site is never meant to be embedded anywhere.
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // All routes — this is a login/billing/time-tracking site with no
        // route that should ever skip these.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
