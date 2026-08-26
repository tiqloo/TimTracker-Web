import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/" is the public marketing homepage (unauthenticated visitors land
// here, and signed-in users may revisit it too — it is never gated or
// redirected away from). The (auth)/* pages (/login, /register,
// /reset-password) are also reachable while signed OUT. Everything under
// "/dashboard" (the entire former (dashboard)/* route group, moved from
// the site root to this prefix so the protected area has one consistent
// namespace — see TimTracker-Starter/docs/tickets/018-account-website.md's
// "public homepage" addendum for the full old-path -> new-path mapping)
// requires a session.
const PROTECTED_PREFIX = "/dashboard";
// Of the public auth paths, these two additionally redirect AWAY to
// "/dashboard" when a session already exists, so a signed-in user doesn't
// see the login/register form again. /reset-password is deliberately
// excluded from that second list: a real password-recovery link (Ticket
// 009) establishes a temporary session client-side via Supabase's
// PASSWORD_RECOVERY event, and the user must still be able to reach that
// page's "set new password" form while that session is active.
const REDIRECT_IF_AUTHENTICATED_PATHS = ["/login", "/register"];

function isProtectedPath(pathname: string): boolean {
  return pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`);
}

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
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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

  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    // Bounce back to the originally requested page after a successful
    // login (see app/(auth)/login/page.tsx).
    loginUrl.searchParams.set("redirectTo", pathname);
    // Carry over any cookies the session-refresh above just set (e.g. a
    // refreshed access token) onto the redirect response — otherwise
    // that refresh would be silently dropped instead of persisted.
    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  if (user && REDIRECT_IF_AUTHENTICATED_PATHS.includes(pathname)) {
    return copyCookies(
      response,
      NextResponse.redirect(new URL(PROTECTED_PREFIX, request.url)),
    );
  }

  return response;
}

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
