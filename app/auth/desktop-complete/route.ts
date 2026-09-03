import { NextResponse, type NextRequest } from "next/server";
import { getDesktopHandoffTokens } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/server";

// Ticket 079 (TimTracker-Starter repo, überarbeitet 2026-09-03): letzter
// Schritt der "genau wie bei Claude"-Anmeldung.
//
// Bewusst ein Route Handler (echte Server-seitige HTTP-Antwort), NICHT
// eine Client-Component-Seite mit `useEffect`/`window.location.href`: ein
// JS-Redirect nach einem `await` (z. B. `getSession()`) verliert in den
// meisten Browsern die "User Activation" der ursprünglichen Klick-Geste,
// wodurch die Navigation zu einem eigenen URL-Schema
// (`tiqloo-auth://...`) stillschweigend blockiert wird — real
// reproduziert: die App öffnete sich nicht automatisch, nur über einen
// zusätzlichen manuellen Button.
//
// Bewusst KEIN reiner `NextResponse.redirect(callbackUrl)` (erste
// Fassung dieser Datei): ein HTTP-Redirect direkt auf ein eigenes
// URL-Schema ist für den Browser nichts Darstellbares — der Tab bleibt
// sichtbar in einem "lädt noch"-Zustand hängen, statt sauber
// abzuschließen (real reproduziert: Nutzer sah einen dauerhaft
// ladenden, nie fertig werdenden Tab, obwohl der Rücksprung in die App
// selbst bereits erfolgreich war). Stattdessen wird eine echte,
// darstellbare HTML-Seite zurückgegeben, die per
// `<meta http-equiv="refresh">` (deklarativ, nicht per Skript nach
// einem `await` — behält die Navigationskette bei) sofort an das
// URL-Schema weiterreicht UND selbst als sauberer Endzustand sichtbar
// bleibt ("Du kannst dieses Fenster jetzt schließen"), inklusive eines
// manuellen Fallback-Buttons für den Fall, dass der automatische
// Rücksprung vom Browser blockiert wird.
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderHandoffPage(callbackHref: string): string {
  const safeHref = escapeHtmlAttribute(callbackHref);
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${safeHref}">
<title>Anmeldung erfolgreich – Tiqloo</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f4f8; color: #171a2e; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
  .card { background: #ffffff; border-radius: 20px; padding: 40px 36px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 20px 60px -30px rgba(23, 26, 46, 0.35); }
  h1 { font-size: 21px; font-weight: 600; margin: 0 0 10px; }
  p { color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
  a.button { display: inline-block; background: #171a2e; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 999px; font-weight: 600; font-size: 14px; }
  a.button:hover { background: #2a2f4d; }
</style>
</head>
<body>
  <div class="card">
    <h1>Anmeldung erfolgreich</h1>
    <p>Tiqloo öffnet sich automatisch. Du kannst dieses Fenster danach schließen.</p>
    <a class="button" href="${safeHref}">Tiqloo öffnen</a>
  </div>
</body>
</html>`;
}

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

  return new NextResponse(renderHandoffPage(callbackUrl.toString()), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
