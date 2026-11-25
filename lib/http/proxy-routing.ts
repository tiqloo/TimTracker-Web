import { normalizeHistoryDateRangeParams } from "../domain/calendar-day.ts";

const PROTECTED_PREFIX = "/dashboard";
const REDIRECT_IF_AUTHENTICATED_PATHS = new Set(["/login", "/register"]);
// Ticket 138: the company-onboarding step runs strictly AFTER account
// creation (it calls create_organization_workspace, which needs
// auth.uid()) — unlike "/register" itself, an unauthenticated visit here
// must bounce to /login, not render a form that could only fail.
const EXTRA_PROTECTED_PATHS = new Set(["/register/company"]);

export function isProtectedPath(pathname: string): boolean {
  return (
    pathname === PROTECTED_PREFIX ||
    pathname.startsWith(`${PROTECTED_PREFIX}/`) ||
    EXTRA_PROTECTED_PATHS.has(pathname)
  );
}

export function shouldRedirectAuthenticatedUser(pathname: string): boolean {
  return REDIRECT_IF_AUTHENTICATED_PATHS.has(pathname);
}

export function shouldValidateHistoryRange(pathname: string): boolean {
  // Export Route Handlers validate their own ranges so their JSON error
  // contract (including a correlation ID) remains observable. The proxy
  // only owns the HTML history page, which has no Route Handler boundary.
  return pathname === "/dashboard/history";
}

// GitHub #47: the "Historie" page used to answer an out-of-range request
// (future end date, > MAX days, from > to, malformed day) with a bare
// English 400 text page. Returns the corrected query string to redirect
// to, or `null` when the request is already valid. Unrelated params are
// kept; an empty correction drops from/to so the page shows its default.
export function historyRangeRedirectSearch(today: string, searchParams: URLSearchParams): string | null {
  const corrected = normalizeHistoryDateRangeParams(today, {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  if (corrected === null) return null;
  const next = new URLSearchParams(searchParams);
  next.delete("from");
  next.delete("to");
  if (corrected.from) next.set("from", corrected.from);
  if (corrected.to) next.set("to", corrected.to);
  const query = next.toString();
  return query ? `?${query}` : "";
}
