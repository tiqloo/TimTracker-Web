import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  calendarDayInTimeZone,
  InvalidHistoryRangeError,
  resolveHistoryDateRange,
} from "@/lib/domain/calendar-day";
import { normalizeDashboardRedirect } from "@/lib/domain/redirect-target";
import {
  isProtectedPath,
  shouldRedirectAuthenticatedUser,
  shouldValidateHistoryRange,
} from "@/lib/http/proxy-routing";

// "/" is the public marketing homepage (unauthenticated visitors land
// here, and signed-in users may revisit it too — it is never gated or
// redirected away from). The (auth)/* pages (/login, /register,
// /reset-password) are also reachable while signed OUT. Everything under
// "/dashboard" (the entire former (dashboard)/* route group, moved from
// the site root to this prefix so the protected area has one consistent
// namespace — see TimTracker-Starter/docs/tickets/018-account-website.md's
// "public homepage" addendum for the full old-path -> new-path mapping)
// requires a session.
// Of the public auth paths, these two additionally redirect AWAY to
// "/dashboard" when a session already exists, so a signed-in user doesn't
// see the login/register form again. /reset-password is deliberately
// excluded from that second list: a real password-recovery link (Ticket
// 009) establishes a temporary session client-side via Supabase's
// PASSWORD_RECOVERY event, and the user must still be able to reach that
// page's "set new password" form while that session is active.

// ---------------------------------------------------------------------
// Ticket 027 (TimTracker-Starter/docs/tickets/027-web-security-headers.md)
// — Content-Security-Policy.
//
// This lives here, in the proxy/middleware, NOT in next.config.ts's
// static headers() (which still owns the other, per-request-independent
// headers: X-Content-Type-Options, Referrer-Policy,
// Strict-Transport-Security, X-Frame-Options — see that file). Reason:
// Next.js itself emits inline <script> tags for its own RSC-hydration/
// streaming bootstrap on every page — framework-internal, nothing this
// app wrote — and a CSP with no 'unsafe-inline' has to give THOSE a
// nonce to be allowed to run, which must be fresh per request. A static
// next.config.ts header can't do that; a nonce generated per-request in
// middleware can. This is Next's own documented pattern for exactly this
// (App Router "Content Security Policy" guide).
//
// Verified for real, not just by reading the config: a first version of
// this ticket's work used a static `script-src 'self'` (no nonce) in
// next.config.ts. `npm run build && npm run start` looked completely
// fine by `curl -I` (all 5 headers present, right values). Loading the
// actual pages in a real browser (Playwright driving installed Google
// Chrome, since curl can't execute JS/enforce CSP) told a different
// story: every page's console was full of "Executing inline script
// violates the following Content Security Policy directive
// 'script-src 'self''" and the page never finished hydrating (React
// error #412 in the console) — login form, dashboard, everything. Moved
// the CSP here with a nonce + 'strict-dynamic' and the same browser test
// came back completely clean (see the Ticket 027 report for the exact
// before/after console output). Exactly the "too-strict CSP breaks
// things silently, curl alone won't show it" failure mode the ticket's
// Edge Cases section warned about.
//
// SUPABASE_HOST: same reasoning as the createServerClient call below —
// this is the one Supabase project this deployment's NEXT_PUBLIC_SUPABASE_URL
// actually points at (the real production project in a Vercel build, the
// local Docker stack in local dev/testing — see README.md's ".env.local:
// lokal gegen Docker"). Deriving it from the same env var everything else
// here already uses keeps this a single source of truth with no risk of
// drift from a hardcoded value, while still being a precise single-origin
// allowlist entry (new URL(...).origin), not a wildcard.
const SUPABASE_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;

// What was actually checked before writing this directive list (see the
// ticket for why this matters — an overly strict CSP fails silently, not
// with a build error):
// - Stripe: no @stripe/stripe-js or any client-side Stripe import
//   anywhere in the app (grepped app/, components/, lib/). "Abo
//   verwalten" (components/ManageSubscriptionButton.tsx) calls the
//   already-deployed create-portal-session Supabase Edge Function via
//   supabase-js — that traffic goes to SUPABASE_HOST above, already
//   covered by connect-src — and then does a plain top-level
//   `window.location.href = url` redirect to the Stripe-hosted billing
//   portal. That's a navigation, not a fetch/iframe/script load, so it
//   needs no CSP allowance at all (frame-src/script-src/connect-src for
//   any Stripe domain would be unused permissions, not "as tight as
//   possible without breaking anything").
// - Vercel Analytics / Speed Insights / any other first-party script:
//   not a dependency (checked package.json) and no next/script usage
//   anywhere — nothing to allowlist for it.
// - Fonts: app/layout.tsx uses next/font/google (Geist, Geist Mono),
//   which self-hosts the font files at build time under this site's own
//   origin — no runtime request to fonts.googleapis.com/fonts.gstatic.com,
//   so font-src 'self' is sufficient.
// - Images: no next/image, no <img>, no CSS data: URIs anywhere in the
//   app (the unused public/*.svg template files from create-next-app are
//   never referenced) — img-src 'self' is sufficient, no data:/blob:
//   needed.
// - CSV/PDF export (app/(dashboard)/dashboard/history/export/*) are
//   server-side Route Handlers returning a file response behind a plain
//   <a href> — same-origin navigation, not a client-side
//   Blob/createObjectURL download, so nothing extra needed there either.
// - Inline styles: several components use React's `style={{...}}` prop
//   (app/page.tsx, components/ProjectsClient.tsx,
//   lib/pdf/history-export-document.tsx), which renders as an inline
//   `style` HTML attribute. CSP has no nonce/hash mechanism for inline
//   style ATTRIBUTES (only for <style> blocks/<link> stylesheets), so
//   style-src needs 'unsafe-inline' — the narrowest fix short of
//   refactoring every inline style prop to a class. This is the only
//   'unsafe-inline' anywhere in this policy — script-src uses a real
//   nonce instead, never 'unsafe-inline'/'unsafe-eval'.
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' trusts any script a nonce'd script itself inserts
    // (how Next.js loads its own chunked bundles at runtime) without
    // listing every chunk individually — official Next.js guidance for
    // this exact nonce setup. Browsers that don't support it just fall
    // back to the 'self'/nonce entries.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    `connect-src 'self' ${SUPABASE_HOST}`,
    "frame-src 'none'",
    // Equivalent to X-Frame-Options: DENY (next.config.ts), kept
    // alongside it for browsers that only honor one or the other — this
    // site is never meant to be embedded anywhere.
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// CSP is production-only, same reasoning as previously documented in
// next.config.ts: `next dev`'s Fast Refresh/HMR has its own inline-script
// and eval needs that a strict CSP isn't verified against here, and this
// ticket's testing bar is `npm run build && npm run start` (both force
// NODE_ENV=production, same as a real Vercel deploy) — that's the mode
// this policy is written for and tested against.
const isProduction = process.env.NODE_ENV === "production";

// Refreshes the Supabase auth session on every request, per the standard
// @supabase/ssr Next.js proxy (formerly middleware) pattern, AND gates
// route access. Redirect-on-missing-session is arguably still
// infrastructure-level auth gating rather than business logic — it needs
// no knowledge of *why* a route is protected, only *whether* a session
// cookie is present — so it stays here per the 2026-08-25 review's
// guidance to keep proxy.ts thin/infrastructure-only. Anything that
// depends on WHAT the user may do once authenticated (e.g. subscription
// state via canUseApp()) still belongs in lib/domain*/lib/application*,
// not here.
export async function proxy(request: NextRequest) {
  // Nonce is generated once per request and threaded through in three
  // places: as an `x-nonce` request header (so a Server Component could
  // read it via headers() and pass it to a next/script `nonce` prop, if
  // one is ever added), as the actual Content-Security-Policy request
  // header (this is what lets Next.js itself detect the nonce and apply
  // it automatically to the framework's own inline scripts — verified
  // empirically, see the comment above buildCsp()), and as the
  // Content-Security-Policy response header (what the browser actually
  // enforces).
  const nonce = isProduction
    ? Buffer.from(crypto.randomUUID()).toString("base64")
    : null;
  const csp = nonce ? buildCsp(nonce) : null;

  const requestHeaders = new Headers(request.headers);
  if (nonce && csp) {
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
  }

  function nextResponse(): NextResponse {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (csp) {
      res.headers.set("Content-Security-Policy", csp);
    }
    return res;
  }

  let response = nextResponse();

  const { pathname } = request.nextUrl;
  if (shouldValidateHistoryRange(pathname)) {
    try {
      resolveHistoryDateRange(calendarDayInTimeZone(new Date()), {
        from: request.nextUrl.searchParams.get("from") ?? undefined,
        to: request.nextUrl.searchParams.get("to") ?? undefined,
      });
    } catch (error) {
      if (error instanceof InvalidHistoryRangeError) {
        return withCsp(new NextResponse(error.message, { status: 400 }), csp);
      }
      throw error;
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = nextResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    // Bounce back to the originally requested page after a successful
    // login (see app/(auth)/login/page.tsx).
    loginUrl.searchParams.set("redirectTo", pathname);
    // Carry over any cookies the session-refresh above just set (e.g. a
    // refreshed access token) onto the redirect response — otherwise
    // that refresh would be silently dropped instead of persisted.
    return copyCookies(response, withCsp(NextResponse.redirect(loginUrl), csp));
  }

  if (user && shouldRedirectAuthenticatedUser(pathname)) {
    // Ticket 094: unconditional "/dashboard" here dropped a `redirectTo`
    // query param on the floor — the native Mac app opens
    // `/login?redirectTo=/auth/desktop-complete` to hand a session back to
    // the desktop app (Ticket 079), and a browser that ALREADY has a valid
    // web session used to get redirected straight to the normal dashboard
    // instead, silently abandoning the desktop handoff (confirmed bug
    // report: "Nutzer meldet sich [...] ab [...] Browser bleibt angemeldet
    // [...] Desktop-Authentifizierungsprozess wird nicht abgeschlossen").
    // `normalizeDashboardRedirect` (already used for the POST-login
    // redirect in `components/LoginForm.tsx`) is the same hardened
    // allowlist — reusing it here means an already-authenticated visit to
    // /login with that exact `redirectTo` now lands on
    // `/auth/desktop-complete`, which already knows how to hand the
    // EXISTING session's tokens back to the desktop app without asking for
    // credentials again. Falls back to `/dashboard` for anything else,
    // identical to the previous unconditional behavior.
    const redirectTarget = normalizeDashboardRedirect(request.nextUrl.searchParams.get("redirectTo"));
    return copyCookies(
      response,
      withCsp(NextResponse.redirect(new URL(redirectTarget, request.url)), csp),
    );
  }

  return response;
}

function withCsp(res: NextResponse, csp: string | null): NextResponse {
  if (csp) {
    res.headers.set("Content-Security-Policy", csp);
  }
  return res;
}

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
