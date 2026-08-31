// Shared layout shell for the three (auth)/* pages — flat/simple on
// purpose (no wizard, no multi-column layout), matching the project's
// established "keep it simple" design preference (see CLAUDE.md). Pure
// presentation, no data access, so it sits outside lib/application/* and
// isn't subject to the app/* import boundary.
export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-sm rounded-xl border border-line p-8">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export const authInputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 disabled:opacity-50";

export const authButtonClass =
  "w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50";

export const authErrorClass =
  "rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400";

export const authSuccessClass =
  "rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400";
