// Shared building blocks for every app/(dashboard)/**/loading.tsx file
// (Ticket 072, TimTracker-Starter repo). Next.js renders a route's
// loading.tsx INSTANTLY on navigation — before the destination route's own
// Server Component has even started its data fetch (auth check + however
// many Supabase queries) — so these must stay pure, synchronous, and free
// of any lib/application/*, lib/repositories/* or Supabase import. That's
// the whole point of this ticket: visible feedback the instant the click
// happens, not after any round trip.
//
// Kept intentionally small: one pulsing-rectangle primitive plus a
// role="status" wrapper, composed differently per route in each
// loading.tsx to roughly match that route's real card layout (rounded-2xl
// cards, --surface/--line tokens, per Ticket 048's design system) — a
// generic gray box would look worse than no loading.tsx at all.
//
// Uses Tailwind's built-in `animate-pulse` (opacity pulse, ~2s, ships with
// Tailwind, no config needed) rather than this app's own custom
// `animate-content-fade-in`/`animate-dropdown-in` keyframes (globals.css)
// — those are one-shot reveal animations for real content that has just
// arrived; this is a continuous "still loading" indicator, a different
// animation category. Matches Ticket 072's AK verbatim: "kein
// Spinner-Overkill", "subtiler Pulse/Shimmer höchstens".
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

// role="status" + sr-only text: a screen reader announces "Loading" once
// instead of reading through a wall of unlabeled empty <div>s.
// Deliberately NOT localized via lib/i18n.ts — loading.tsx renders before
// the destination page/layout has resolved anything, including the
// effective UI language, and re-deriving that here (a header read, plus
// wiring every one of the 11 loading.tsx files to be async for it) would
// reintroduce exactly the kind of per-navigation work this ticket exists
// to keep off the critical path, just for a screen-reader-only string.
export function SkeletonScreen({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

// The "eyebrow label + big H1" heading pattern most (dashboard)/* pages
// share (Heute/Einstellungen/Analytics/Get-Started use the eyebrow tier;
// Historie/Projekte/Historie-Tag/Changelog/Helpcenter/Billing skip it) —
// sized to match the real `text-[34px] sm:text-[40px]` heading exactly so
// the page doesn't visibly reflow once real content swaps in.
export function SkeletonHeading({ eyebrow = false }: { eyebrow?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {eyebrow && <SkeletonBlock className="h-3 w-24" />}
      <SkeletonBlock className="h-9 w-56 sm:h-10 sm:w-72" />
    </div>
  );
}

// One row of the "flat list of days/entries", the shape Historie/
// Changelog/Helpcenter all share (divide-y divide-line border-t
// border-line list of rows).
export function SkeletonListRow() {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 first:border-t">
      <SkeletonBlock className="h-4 w-28" />
      <SkeletonBlock className="h-4 w-40" />
    </div>
  );
}

// The `rounded-2xl border border-line/90 bg-surface p-5 sm:p-8` card shell
// used across Heute/Get-Started/Analytics/Historie-Tag — this wrapper
// alone (no content) is often enough to make a skeleton read as "the same
// card is about to appear here" rather than a generic block.
export function SkeletonCard({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line/90 bg-surface p-5 sm:p-8 ${className}`}>
      {children}
    </div>
  );
}
