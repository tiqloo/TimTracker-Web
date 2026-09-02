// Shared layout shell for the three (auth)/* pages — flat/simple on
// purpose (no wizard, no multi-column layout), matching the project's
// established "keep it simple" design preference (see CLAUDE.md). Pure
// presentation, no data access, so it sits outside lib/application/* and
// isn't subject to the app/* import boundary.
import { primaryButtonClass } from "@/lib/ui/button-styles";
import { errorMessageClass, successMessageClass } from "@/lib/ui/status-styles";
import { Check, Clock3 } from "lucide-react";

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-shell min-h-screen flex-1 p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl animate-content-fade-in overflow-hidden rounded-[28px] border border-white/60 bg-surface shadow-[0_32px_90px_-40px_rgba(35,42,90,0.35)] sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-[#171a2e] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="auth-orb auth-orb-one" />
          <div className="auth-orb auth-orb-two" />
          <div className="relative z-10 flex items-center gap-3 text-sm font-semibold tracking-wide">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Clock3 size={21} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span>Tiqloo</span>
          </div>

          <div className="relative z-10 max-w-md">
            <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-indigo-200 uppercase">
              Fokus auf deine Zeit
            </p>
            <h2 className="font-display text-5xl leading-[1.05] font-semibold tracking-[-0.04em]">
              Arbeit sichtbar machen. Ohne Aufwand.
            </h2>
            <p className="mt-6 max-w-sm text-base leading-7 text-white/65">
              Erfasse deinen Tag automatisch, ordne Zeiten Projekten zu und behalte deine Ziele im Blick.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/70">
            {['Automatische Erfassung', 'Klare Auswertungen', 'Volle Kontrolle'].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-400/20 text-indigo-200">
                  <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                </span>
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white shadow-sm">
                <Clock3 size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="font-semibold tracking-tight">Tiqloo</span>
            </div>
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-brand uppercase">Willkommen zurück</p>
            <h1 className="mb-8 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{title}</h1>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

export const authInputClass =
  "h-12 w-full rounded-xl border border-line bg-background/60 px-4 text-sm outline-none transition duration-150 placeholder:text-text-secondary/60 hover:border-foreground/20 focus:border-brand focus:bg-surface focus-visible:ring-4 focus-visible:ring-brand/10 disabled:opacity-50";

// Ticket 048: Primary tier (lib/ui/button-styles.ts) — was a locally
// defined, slightly different bg-brand string before this ticket's button
// consolidation pass.
export const authButtonClass = `${primaryButtonClass} mt-1 h-12 w-full rounded-xl shadow-[0_10px_24px_-12px_rgba(82,97,230,0.8)]`;

// Ticket 048: lib/ui/status-styles.ts (--danger/--success tokens) — was a
// locally defined bg-red-500/10 / bg-green-500/10 pair before this
// ticket's status-token consolidation pass.
export const authErrorClass = errorMessageClass;
export const authSuccessClass = successMessageClass;
