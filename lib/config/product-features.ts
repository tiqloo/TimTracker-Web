export type ProductMode = "personal" | "workspace";

export interface ProductFeatures {
  mode: ProductMode;
  workspaceAndTeam: boolean;
  organizationRegistration: boolean;
  invitations: boolean;
}

// One reversible product switch. Personal is deliberately the safe default:
// workspace/team code and data stay intact, but no organization surface is
// exposed unless a deployment explicitly opts back in.
export function resolveProductFeatures(rawMode: string | undefined): ProductFeatures {
  const workspaceAndTeam = rawMode?.trim().toLowerCase() === "workspace";
  return {
    mode: workspaceAndTeam ? "workspace" : "personal",
    workspaceAndTeam,
    organizationRegistration: workspaceAndTeam,
    invitations: workspaceAndTeam,
  };
}

export const productFeatures = resolveProductFeatures(process.env.NEXT_PUBLIC_PRODUCT_MODE);

const WORKSPACE_ONLY_EXACT_PATHS = new Set([
  "/register/company",
  "/invite/accept",
  "/dashboard/team-times",
  "/dashboard/overview",
  "/dashboard/company-analytics",
]);

export function isWorkspaceOnlyPath(pathname: string): boolean {
  return (
    WORKSPACE_ONLY_EXACT_PATHS.has(pathname) ||
    pathname.startsWith("/invite/accept/") ||
    pathname === "/dashboard/workspaces" ||
    pathname.startsWith("/dashboard/workspaces/")
  );
}

export function disabledWorkspaceFeatureRedirect(pathname: string, authenticated: boolean): string | null {
  if (productFeatures.workspaceAndTeam || !isWorkspaceOnlyPath(pathname)) return null;
  if (pathname === "/register/company" || pathname.startsWith("/invite/accept")) {
    return authenticated ? "/dashboard" : "/register";
  }
  return authenticated ? "/dashboard" : "/login";
}
