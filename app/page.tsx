import Link from "next/link";

// Public marketing homepage — "/" itself, now unprotected (see proxy.ts;
// the former (dashboard)/* route group that used to live here moved to
// /dashboard, see TimTracker-Starter/docs/tickets/018-account-website.md's
// "public homepage" addendum for the full mapping). Structurally inspired
// by macpaw.com/macpaw.com/community (large bold headline in a light card,
// a feature grid, an alternating tagged narrative section, a plain
// footer) — adapted to a single small real product, not literally copied.
// Every feature listed below corresponds to something actually shipped in
// Phase 1 of Ticket 018 (see that file); nothing here is aspirational
// copy for a feature that doesn't exist yet.
//
// Deliberately a plain Server Component with no data fetching — this page
// has nothing user-specific to show (logged-in visitors see the same
// page as logged-out ones, see proxy.ts's comment on why "/" is never
// redirect-gated), so there's no Repositories/getRepositories() call here
// unlike every (dashboard)/* page.
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <SiteNav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Features />
        <Narrative />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteNav() {
  return (
    <header className="px-4 pt-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-full border border-black/10 bg-white/70 px-4 py-2.5 backdrop-blur dark:border-white/15 dark:bg-black/40">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          TimTracker
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            Anmelden
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background"
          >
            Registrieren
          </Link>
        </nav>
      </div>
    </header>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path
        d="M3.5 8h9M8.5 3.5 13 8l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Hero() {
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-6xl rounded-[2.5rem] bg-[#f2f1fa] px-6 py-16 text-center sm:px-12 sm:py-24 dark:bg-white/[0.04]">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          Zeit erfassen, ohne daran zu denken.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-black/70 sm:text-lg dark:text-white/70">
          TimTracker läuft im Hintergrund auf deinem Mac (Windows folgt) und
          erfasst deine Arbeitszeit automatisch anhand von Login, Sperren und
          Ruhezustand — kein Start-/Stopp-Knopf, den du vergessen kannst.
          Zeit einzelnen Projekten zuordnen, Historie einsehen und als CSV
          exportieren geht direkt hier im Web-Dashboard.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
          >
            Kostenlos starten
            <ArrowIcon />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-6 py-3 text-sm font-medium dark:border-white/20"
          >
            Anmelden
          </Link>
        </div>
        <p className="mt-4 text-xs text-black/50 dark:text-white/50">
          7 Tage kostenlos testen, keine Kreditkarte nötig für den Trial.
        </p>
      </div>
    </section>
  );
}

const FEATURES: { title: string; description: string; icon: string }[] = [
  {
    icon: "◐",
    title: "Automatisches Tracking",
    description:
      "Erfasst Anwesenheit anhand von Login, Wake/Sleep und Bildschirmsperre — kein manuelles Starten oder Stoppen nötig.",
  },
  {
    icon: "▤",
    title: "Projekte",
    description:
      "Erfasste Zeit im Nachhinein einzelnen Projekten oder Kunden zuordnen, statt jede Session einzeln zu takten.",
  },
  {
    icon: "↓",
    title: "Historie & Export",
    description:
      "Vergangene Tage einsehen und den gewählten Zeitraum als CSV exportieren — passend für Excel, Numbers oder die Buchhaltung.",
  },
  {
    icon: "◫",
    title: "Web-Dashboard",
    description:
      "Heute-Übersicht, Historie, Projekte und Einstellungen auch im Browser abrufbar — mit demselben Account wie in der App.",
  },
  {
    icon: "✓",
    title: "7 Tage kostenlos testen",
    description:
      "Voller Funktionsumfang während der Testphase, danach ein einfaches Abo — jederzeit über die Einstellungen verwaltbar.",
  },
];

function Features() {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Was TimTracker macht
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 rounded-2xl border border-black/10 p-6 dark:border-white/15"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f1fa] text-base dark:bg-white/10">
                {feature.icon}
              </span>
              <h3 className="text-sm font-semibold">{feature.title}</h3>
              <p className="text-sm text-black/65 dark:text-white/65">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const NARRATIVE_SECTIONS: { tag: string; heading: string; body: string }[] = [
  {
    tag: "Für wen",
    heading: "Gebaut für Freelancer und Entwickler, die das Tracken vergessen",
    body: "Ein manueller Timer wird im Arbeitsalltag zuverlässig vergessen — beim Kunden-Call, beim Debuggen, beim Wechsel zwischen Projekten. TimTracker setzt deshalb nicht auf Disziplin, sondern erfasst Anwesenheit automatisch im Hintergrund, sobald du am Rechner bist.",
  },
  {
    tag: "Ehrlich",
    heading: "Automatik zuerst, Zuordnung im Nachhinein",
    body: "Erfasst wird zunächst nur Anwesenheitszeit, keine App- oder Website-Nutzung. Welchem Projekt diese Zeit gehört, ordnest du danach zu — in der App oder direkt hier im Dashboard.",
  },
  {
    tag: "Plattformübergreifend",
    heading: "Ein Account, App und Web",
    body: "Login, Historie und Projekte sind zwischen der macOS-App (Windows in Arbeit) und diesem Web-Dashboard synchron — derselbe Account, dieselben Daten, egal von wo du gerade draufschaust.",
  },
];

function Narrative() {
  return (
    <section className="bg-[#f7f7fb] px-4 py-14 sm:px-6 sm:py-20 dark:bg-white/[0.03]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
        {NARRATIVE_SECTIONS.map((section) => (
          <div
            key={section.tag}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr] sm:gap-8"
          >
            <span className="text-xs font-semibold tracking-wide text-black/50 uppercase dark:text-white/50">
              {section.tag}
            </span>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {section.heading}
              </h3>
              <p className="max-w-2xl text-sm text-black/70 sm:text-base dark:text-white/70">
                {section.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Same purity-rule workaround already established elsewhere in this repo
// (see e.g. app/(dashboard)/dashboard/page.tsx's currentTimeMs()) — a
// named wrapper outside the component instead of a direct `new Date()`
// call in the component body. This page renders once per request on the
// server, so "now" as of render time is the intended value for the
// copyright year, not a purity bug.
function currentYear(): number {
  return new Date().getFullYear();
}

function SiteFooter() {
  return (
    <footer className="border-t border-black/10 px-4 py-10 sm:px-6 dark:border-white/15">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">TimTracker</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Fragen zu deinem Account? Erreichbar über die Support-Adresse in
            deiner Bestätigungs-E-Mail.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/login" className="underline">
            Anmelden
          </Link>
          <Link href="/register" className="underline">
            Registrieren
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-8 w-full max-w-6xl text-xs text-black/40 dark:text-white/40">
        © {currentYear()} TimTracker
      </p>
    </footer>
  );
}
