import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public (auth)/* routes — reachable while signed OUT. Everything else
// (all of (dashboard)/*, including "/" itself — the "Heute" page lives at
// the route group's root) requires a session.
const PUBLIC_PATHS = ["/login", "/register", "/reset-password"];
// Of those, these two additionally redirect AWAY to "/" when a session
// already exists, so a signed-in user doesn't see the login/register form
// again. /reset-password is deliberately excluded from that second list:
// a real password-recovery link (Ticket 009) establishes a temporary
// session client-side via Supabase's PASSWORD_RECOVERY event, and the
// user must still be able to reach that page's "set new password" form
// while that session is active.
const REDIRECT_IF_AUTHENTICATED_PATHS = ["/login", "/register"];

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
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!user && !isPublicPath) {
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
    return copyCookies(response, NextResponse.redirect(new URL("/", request.url)));
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
