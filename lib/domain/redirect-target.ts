const DEFAULT_REDIRECT_TARGET = "/dashboard";

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
    if (
      resolved.origin !== base.origin ||
      (resolved.pathname !== "/dashboard" && !resolved.pathname.startsWith("/dashboard/"))
    ) return DEFAULT_REDIRECT_TARGET;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return DEFAULT_REDIRECT_TARGET;
  }
}
