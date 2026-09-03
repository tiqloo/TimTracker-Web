const DEFAULT_REDIRECT_TARGET = "/dashboard";

// Ticket 079 (TimTracker-Starter, überarbeitet 2026-09-03): die native
// Mac-App öffnet diese Login-Seite mit `?redirectTo=/auth/desktop-complete`,
// damit ein erfolgreicher Web-Login (E-Mail/Passwort ODER Google) dort statt
// im Dashboard landet und die Session-Tokens zurück an die App reicht.
// Exaktes Match (kein Präfix wie bei /dashboard) — diese Seite hat keine
// Unterrouten.
const EXACT_ALLOWED_TARGETS = new Set(["/auth/desktop-complete"]);

export function normalizeDashboardRedirect(rawTarget: string | null | undefined): string {
  if (!rawTarget) return DEFAULT_REDIRECT_TARGET;
  let target = rawTarget.trim();
  if (!target || /[\\\u0000-\u001f\u007f]/u.test(target)) return DEFAULT_REDIRECT_TARGET;

  try {
    for (let pass = 0; pass < 3; pass += 1) {
      const decoded = decodeURIComponent(target);
      if (decoded === target) break;
      target = decoded;
    }
  } catch {
    return DEFAULT_REDIRECT_TARGET;
  }

  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return DEFAULT_REDIRECT_TARGET;
  }

  try {
    const base = new URL("https://timtracker.invalid");
    const resolved = new URL(target, base);
    if (resolved.origin !== base.origin) return DEFAULT_REDIRECT_TARGET;
    if (
      resolved.pathname === "/dashboard" ||
      resolved.pathname.startsWith("/dashboard/") ||
      EXACT_ALLOWED_TARGETS.has(resolved.pathname)
    ) {
      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
    return DEFAULT_REDIRECT_TARGET;
  } catch {
    return DEFAULT_REDIRECT_TARGET;
  }
}
