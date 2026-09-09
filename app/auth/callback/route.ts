import { NextResponse, type NextRequest } from "next/server";
import { completeOAuthSignIn, resolvePostAuthDestination } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/server";
import { normalizeDashboardRedirect } from "@/lib/domain/redirect-target";

function siteUrl(path: string): URL {
  return new URL(path, process.env.NEXT_PUBLIC_SITE_URL!);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedDestination = normalizeDashboardRedirect(
    request.nextUrl.searchParams.get("next"),
  );

  if (code) {
    try {
      const repos = await getRepositories();
      await completeOAuthSignIn(repos, code);
      // Ticket 164/168 — same resumption rule as email/password login
      // (components/LoginForm.tsx): a Google sign-in that landed here
      // still owes a check for an abandoned company onboarding, exactly
      // like every other way of re-authenticating.
      const destination = await resolvePostAuthDestination(repos, requestedDestination);
      return NextResponse.redirect(siteUrl(destination));
    } catch {
      // Fall through to the same non-technical error shown for a missing
      // or rejected callback code. Raw provider details never reach the UI.
    }
  }

  const errorUrl = siteUrl("/login");
  errorUrl.searchParams.set("error", "oauth_callback_failed");
  return NextResponse.redirect(errorUrl);
}
