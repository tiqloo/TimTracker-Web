import { NextResponse, type NextRequest } from "next/server";
import { getDesktopHandoffTokens } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/server";

// Ticket 079 (TimTracker-Starter repo, überarbeitet 2026-09-03): letzter
// Schritt der "genau wie bei Claude"-Anmeldung. Bewusst ein Route Handler
// (echter Server-seitiger HTTP-Redirect), NICHT eine Client-Component-Seite
// mit `useEffect`/`window.location.href`: ein JS-Redirect nach einem
// `await` (z. B. `getSession()`) verliert in den meisten Browsern die
// "User Activation" der ursprünglichen Klick-Geste, wodurch die Navigation
// zu einem eigenen URL-Schema (`tiqloo-auth://...`) stillschweigend
// blockiert wird — real reproduziert: die App öffnete sich nicht
// automatisch, nur über einen zusätzlichen manuellen Button, was der
// Nutzer-Vorgabe "genau wie bei Claude" (kein sichtbarer Zwischenschritt)
// widerspricht. Ein durchgehender Server-Redirect (wie /auth/callback es
// für den Google-Pfad bereits vormacht) behält die Navigationskette intakt.
export async function GET(request: NextRequest) {
  const repos = await getRepositories();
  const tokens = await getDesktopHandoffTokens(repos);

  if (!tokens) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", "/auth/desktop-complete");
    return NextResponse.redirect(loginUrl);
  }

  const callbackUrl = new URL("tiqloo-auth://oauth/callback");
  // Bewusst im FRAGMENT (`#...`), nicht in der Query — ein Fragment
  // verlässt den Browser bei einer Navigation nie (kein Server sieht es),
  // anders als ein `?`-Parameter, der theoretisch in Server-Logs auf dem
  // Weg dorthin auftauchen könnte.
  callbackUrl.hash = `access_token=${encodeURIComponent(tokens.accessToken)}&refresh_token=${encodeURIComponent(tokens.refreshToken)}`;
  return NextResponse.redirect(callbackUrl);
}
