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
