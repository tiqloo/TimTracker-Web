// Shared layout shell for the three (auth)/* pages — flat/simple on
// purpose (no wizard, no multi-column layout), matching the project's
// established "keep it simple" design preference (see CLAUDE.md). Pure
// presentation, no data access, so it sits outside lib/application/* and
// isn't subject to the app/* import boundary.
import { primaryButtonClass } from "@/lib/ui/button-styles";
import { errorMessageClass, successMessageClass } from "@/lib/ui/status-styles";

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export const authInputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

// Ticket 048: Primary tier (lib/ui/button-styles.ts) — was a locally
// defined, slightly different bg-brand string before this ticket's button
// consolidation pass.
export const authButtonClass = `${primaryButtonClass} w-full`;

// Ticket 048: lib/ui/status-styles.ts (--danger/--success tokens) — was a
// locally defined bg-red-500/10 / bg-green-500/10 pair before this
// ticket's status-token consolidation pass.
export const authErrorClass = errorMessageClass;
export const authSuccessClass = successMessageClass;
