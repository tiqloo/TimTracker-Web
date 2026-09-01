import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  AppWindow,
  CircleCheck,
  Clock,
  Download,
  Tag,
} from "lucide-react";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { home, t, type Lang } from "@/lib/i18n";

// Public marketing homepage — "/" itself, unprotected (see proxy.ts; the
// former (dashboard)/* route group that used to live here moved to
// /dashboard, see TimTracker-Starter/docs/tickets/018-account-website.md's
// "public homepage" addendum for the full mapping).
//
// Redesigned 2026-08-31 (structure feedback: previous version read as a
// generic templated SaaS page — floating pill nav, one big rounded-blob
// hero card, unicode-glyph "icons" — no visual evidence it was actually
// built for a time tracker). This version's signature element is
// DayTimeline below: a real segmented-timeline rendering of the product's
// own two chart colors (--chart-standard/--chart-project, the exact tokens
// components/HistoryChart.tsx uses), showing the product's entire pitch —
// automatic capture first, assignment after — in one glance instead of
// describing it in prose. Mono type (already loaded, previously unused —
// see globals.css) is reserved specifically for timestamps/data
// throughout, prose stays in the sans face; that split is deliberate, not
// decorative (see the module comment on TimeLabel below).
//
// Now async (Ticket 022): resolves the effective UI language the same
// getEffectiveLanguageCode() way every (dashboard)/* page and the root
// layout already do — no login required to read it (a plain cookie, see
// lib/repositories/cookie/language.server.ts), so this still works for a
// fully signed-out visitor. This page still has no OTHER user-specific
// data to show (logged-in visitors see the same page as logged-out ones,
// see proxy.ts's comment on why "/" is never redirect-gated).
export default async function HomePage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <SiteNav lang={lang} />
      <main className="flex flex-1 flex-col">
        <Hero lang={lang} />
        <HowItWorks lang={lang} />
        <Features lang={lang} />
        <Pricing lang={lang} />
        <Narrative lang={lang} />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}

// Ticket 048: hand-drawn Mark() SVG replaced with lucide-react's Clock —
// same "literal clock face, not an abstract logo" reasoning as before,
// now via the shared icon library instead of a bespoke SVG (see
// DashboardNav.tsx's own Ticket 048 comment for the full reasoning; this
// is the same brand mark, independently defined here since this file and
// DashboardNav.tsx are two different route trees with no shared
// component between them). Kept small (18px, the bottom of the ticket's
// 18-20px icon-size band) — inline with the "TimTracker" wordmark at
// text-sm, the same "don't overpower the adjacent text" reasoning
// DashboardNav.tsx's Mark()/SupportIcon() sizing comment gives.
function Mark() {
  return <Clock size={18} strokeWidth={1.5} aria-hidden="true" />;
}

function SiteNav({ lang }: { lang: Lang }) {
  return (
    <header className="border-b border-line px-4 sm:px-6">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Mark />
          TimTracker
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="#features"
            className="hidden rounded-md px-3 py-1.5 text-sm text-foreground/70 transition-colors duration-150 hover:text-foreground sm:inline-block"
          >
            {t(lang, home.navFeatures)}
          </Link>
          <Link
            href="#pricing"
            className="hidden rounded-md px-3 py-1.5 text-sm text-foreground/70 transition-colors duration-150 hover:text-foreground sm:inline-block"
          >
            {t(lang, home.navPricing)}
          </Link>
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-sm text-foreground/70 transition-colors duration-150 hover:text-foreground"
          >
            {t(lang, home.navSignIn)}
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-brand px-3.5 py-1.5 text-sm font-medium text-background transition-colors duration-150 hover:bg-brand/90"
          >
            {t(lang, home.navSignUp)}
          </Link>
        </nav>
      </div>
    </header>
  );
}

// Every timestamp/duration/data-style string on the page goes through this
// — the mono face is reserved for things that are literally data, mirroring
// how the real dashboard renders durations. Prose never uses it.
function TimeLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tabular-nums text-foreground/55">
      {children}
    </span>
  );
}

// Ticket 048: hand-drawn arrow SVG replaced with lucide-react's ArrowRight
// — used inline inside CTA button labels (text-sm), so kept at the same
// compact 14px it was before rather than the spec's full 18-20px "icon"
// band (same "don't overpower the adjacent label text" reasoning as
// Mark() above).
function ArrowIcon() {
  return <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />;
}

// The signature element: one realistic workday, rendered as the exact
// segment/color language components/HistoryChart.tsx uses on the real
// dashboard (--chart-standard = automatic presence, --chart-project =
// time assigned to a project) — a demonstration of the product instead of
// an illustration of it. The empty 12:30–13:15 gap renders as a thin
// muted sliver rather than a blank space on purpose, mirroring Ticket
// 002's AK ("Tage ohne Aktivität zeigen einen 0-Balken statt einer
// Lücke") — same rule, same reason: a gap in a timeline reads as "missing
// data," a sliver reads as "checked, nothing happened."
function daySegments(lang: Lang): {
  from: string;
  to: string;
  kind: "auto" | "project" | "idle";
  label: string;
}[] {
  return [
    { from: "09:02", to: "12:30", kind: "auto", label: t(lang, home.timelineSegmentPresent) },
    { from: "12:30", to: "13:15", kind: "idle", label: t(lang, home.timelineSegmentBreak) },
    { from: "13:15", to: "17:30", kind: "project", label: t(lang, home.timelineSegmentClient) },
    { from: "17:30", to: "18:47", kind: "auto", label: t(lang, home.timelineSegmentPresent) },
  ];
}

const DAY_START_MIN = 9 * 60 + 2;
const DAY_END_MIN = 18 * 60 + 47;
const DAY_SPAN_MIN = DAY_END_MIN - DAY_START_MIN;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function DayTimeline({ lang }: { lang: Lang }) {
  const segments = daySegments(lang);
  return (
    <div className="w-full max-w-md rounded-xl border border-line bg-surface shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:max-w-none">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full border border-line" />
        <span className="h-2.5 w-2.5 rounded-full border border-line" />
        <span className="h-2.5 w-2.5 rounded-full border border-line" />
        <span className="ml-2 text-xs font-medium text-foreground/60">
          {t(lang, home.timelineWindowTitle)}
        </span>
      </div>
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex h-7 w-full overflow-hidden rounded-md border border-line">
          {segments.map((segment, index) => {
            const width =
              ((toMinutes(segment.to) - toMinutes(segment.from)) /
                DAY_SPAN_MIN) *
              100;
            return (
              <div
                key={index}
                title={`${segment.label}: ${segment.from}–${segment.to}`}
                style={{
                  width: `${width}%`,
                  backgroundColor:
                    segment.kind === "auto"
                      ? "var(--chart-standard)"
                      : segment.kind === "project"
                        ? "var(--chart-project)"
                        : "var(--line)",
                }}
                className="h-full first:rounded-l-[5px] last:rounded-r-[5px]"
              />
            );
          })}
        </div>
        <div className="mt-2.5 flex justify-between">
          <TimeLabel>{t(lang, home.timelineLoginTime)}</TimeLabel>
          <TimeLabel>{t(lang, home.timelineSleepTime)}</TimeLabel>
        </div>
        <div className="mt-5 flex items-center gap-4 border-t border-line pt-4">
          <span className="flex items-center gap-1.5 text-xs text-foreground/70">
            <span className="h-2 w-2 rounded-full bg-[var(--chart-standard)]" />
            {t(lang, home.timelineLegendAuto)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-foreground/70">
            <span className="h-2 w-2 rounded-full bg-[var(--chart-project)]" />
            {t(lang, home.timelineLegendProject)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Hero({ lang }: { lang: Lang }) {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <p className="font-mono text-xs tracking-wide text-foreground/50 uppercase">
            {t(lang, home.heroEyebrow)}
          </p>
          {/* Ticket 048: font-display (Schibsted Grotesk, app/layout.tsx) —
              the one place on the whole site this ticket's second typeface
              appears, exactly wohnu.de's own Hero-only --land-display
              usage. Size bumped from the old text-4xl/sm:text-5xl (36/48px)
              to the ticket's "Hero Website 64–72px" scale entry — 48px on
              mobile (unchanged start point, 72px here would overflow a
              small viewport) up to the spec's exact top value at sm+. */}
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl">
            {t(lang, home.heroTitle)}
          </h1>
          <p className="mt-5 max-w-md text-base text-foreground/65 sm:text-lg">
            {t(lang, home.heroBody)}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-background transition-colors duration-150 hover:bg-brand/90"
            >
              {t(lang, home.heroCtaStart)}
              <ArrowIcon />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md border border-line px-5 py-2.5 text-sm font-medium transition-colors duration-150 hover:bg-paper"
            >
              {t(lang, home.heroCtaLogin)}
            </Link>
          </div>
          <p className="mt-4">
            <TimeLabel>{t(lang, home.heroTrialNote)}</TimeLabel>
          </p>
        </div>
        <DayTimeline lang={lang} />
      </div>
    </section>
  );
}

// A real sequence (login happens, then assignment, then export — in that
// order, every time), which is the one case this page uses numbered steps
// for — see the module comment on why that's deliberate rather than
// decorative.
function steps(lang: Lang): { title: string; body: string }[] {
  return [
    { title: t(lang, home.step1Title), body: t(lang, home.step1Body) },
    { title: t(lang, home.step2Title), body: t(lang, home.step2Body) },
    { title: t(lang, home.step3Title), body: t(lang, home.step3Body) },
  ];
}

function HowItWorks({ lang }: { lang: Lang }) {
  return (
    <section className="border-t border-line bg-paper px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t(lang, home.howItWorksTitle)}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
          {steps(lang).map((step, index) => (
            <div key={step.title}>
              <TimeLabel>{String(index + 1).padStart(2, "0")}</TimeLabel>
              <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-foreground/65">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Ticket 048: the five hand-drawn Features-section icons replaced with
// their lucide-react equivalents — standalone, not inline with any text
// (each sits above its own heading/description), so these get the
// ticket's literal 18-20px/1.5-2px band in full, unlike the smaller
// inline icons above (Mark/ArrowIcon) or in DashboardNav.tsx.
function IconClock() {
  return <Clock size={20} strokeWidth={1.5} aria-hidden="true" />;
}

function IconTag() {
  return <Tag size={20} strokeWidth={1.5} aria-hidden="true" />;
}

function IconExport() {
  return <Download size={20} strokeWidth={1.5} aria-hidden="true" />;
}

function IconWindow() {
  return <AppWindow size={20} strokeWidth={1.5} aria-hidden="true" />;
}

function IconCheck() {
  return <CircleCheck size={20} strokeWidth={1.5} aria-hidden="true" />;
}

function features(lang: Lang): {
  title: string;
  description: string;
  Icon: () => React.JSX.Element;
}[] {
  return [
    { Icon: IconClock, title: t(lang, home.feature1Title), description: t(lang, home.feature1Body) },
    { Icon: IconTag, title: t(lang, home.feature2Title), description: t(lang, home.feature2Body) },
    { Icon: IconExport, title: t(lang, home.feature3Title), description: t(lang, home.feature3Body) },
    { Icon: IconWindow, title: t(lang, home.feature4Title), description: t(lang, home.feature4Body) },
    { Icon: IconCheck, title: t(lang, home.feature5Title), description: t(lang, home.feature5Body) },
  ];
}

function Features({ lang }: { lang: Lang }) {
  return (
    <section id="features" className="scroll-mt-14 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t(lang, home.featuresTitle)}
        </h2>
        <div className="mt-8 grid grid-cols-1 divide-y divide-line border-t border-line sm:grid-cols-2">
          {features(lang).map(({ title, description, Icon }, index) => (
            <div
              key={title}
              className={`flex gap-4 py-6 sm:px-6 sm:py-7 ${
                index % 2 === 0 ? "sm:border-r sm:border-line" : ""
              } ${index < 2 ? "" : "sm:border-t sm:border-line"}`}
            >
              <span className="mt-0.5 text-foreground/45">
                <Icon />
              </span>
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-foreground/65">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// The one deliberately heavier-weight card on the page — everywhere else
// uses a plain hairline border, but the pricing decision is the moment a
// visitor is actually deciding, so it earns slightly more visual weight
// (a soft shadow, a subtly tinted background) instead of looking like
// just another list item. Real price (price_1U5Ux1R8NjypN7Hn8wFkoklb in
// the Stripe test account this product actually charges against), not
// placeholder copy — single plan, no tiers, matching this whole site's
// "no feature-gating" pitch.
function pricingFeatures(lang: Lang): string[] {
  return [
    t(lang, home.pricingFeature1),
    t(lang, home.pricingFeature2),
    t(lang, home.pricingFeature3),
    t(lang, home.pricingFeature4),
  ];
}

function Pricing({ lang }: { lang: Lang }) {
  return (
    <section id="pricing" className="scroll-mt-14 border-t border-line px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-xl text-center">
          <p className="font-mono text-xs tracking-wide text-foreground/50 uppercase">
            {t(lang, home.pricingEyebrow)}
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
            {t(lang, home.pricingTitle)}
          </h2>
          <p className="mt-3 text-sm text-foreground/65 sm:text-base">
            {t(lang, home.pricingBody)}
          </p>
        </div>

          {/* Ticket 048: rounded-2xl (16px) -> rounded-xl (12px), the
              ticket's radius AK band for "Karten/größere Container"
              (10-14px). This card keeps its own bg-paper/shadow treatment
              per its module comment above — deliberately the one heavier-
              weight card on the page — the radius unification still
              applies to it like every other card in the app. */}
        <div className="mx-auto mt-10 max-w-sm rounded-xl border border-line bg-paper p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.12)]">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
              {t(lang, home.pricingAmount)}
            </span>
            <span className="text-sm text-foreground/55">{t(lang, home.pricingPeriod)}</span>
          </div>
          <p className="mt-2">
            <TimeLabel>{t(lang, home.pricingTrialNote)}</TimeLabel>
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {pricingFeatures(lang).map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground/80">
                <span className="mt-0.5 shrink-0 text-foreground/45">
                  <IconCheck />
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <Link
            href="/register"
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-background transition-colors duration-150 hover:bg-brand/90"
          >
            {t(lang, home.pricingCta)}
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}

function narrativeSections(lang: Lang): { tag: string; heading: string; body: string }[] {
  return [
    { tag: t(lang, home.narrativeTag1), heading: t(lang, home.narrativeHeading1), body: t(lang, home.narrativeBody1) },
    { tag: t(lang, home.narrativeTag2), heading: t(lang, home.narrativeHeading2), body: t(lang, home.narrativeBody2) },
    { tag: t(lang, home.narrativeTag3), heading: t(lang, home.narrativeHeading3), body: t(lang, home.narrativeBody3) },
  ];
}

function Narrative({ lang }: { lang: Lang }) {
  return (
    <section className="border-t border-line bg-paper px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        {narrativeSections(lang).map((section) => (
          <div
            key={section.tag}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr] sm:gap-8"
          >
            <span className="font-mono text-xs tracking-wide text-foreground/50 uppercase">
              {section.tag}
            </span>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {section.heading}
              </h3>
              <p className="max-w-2xl text-sm text-foreground/65 sm:text-base">
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

function SiteFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="border-t border-line px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Mark />
            TimTracker
          </p>
          <p className="mt-1.5 max-w-sm text-sm text-foreground/60">
            {t(lang, home.footerSupport)}
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/login" className="text-foreground/70 transition-colors duration-150 hover:text-foreground">
            {t(lang, home.navSignIn)}
          </Link>
          <Link href="/register" className="text-foreground/70 transition-colors duration-150 hover:text-foreground">
            {t(lang, home.navSignUp)}
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-8 w-full max-w-5xl">
        <TimeLabel>© {currentYear()} TimTracker</TimeLabel>
      </p>
    </footer>
  );
}
