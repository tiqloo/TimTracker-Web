"use client";

// "Support" page (Ticket 030, TimTracker-Starter repo) — personalized
// greeting, a request box that opens a mailto: link, "Feedback teilen"
// and an Einstellungen quick link, and footer links to the static
// Helpcenter/Produkt-Neuerungen pages. Client Component because the
// request box needs live textarea state to build the mailto: href (same
// reason every other interactive dashboard piece — SettingsClient,
// ProjectsClient — is one), even though nothing here talks to Supabase.
//
// mailto: over a real form/Edge Function for V1: see lib/i18n.ts's
// `support` namespace comment for the full reasoning (docs/audit-findings.md's
// open "kein Custom-SMTP für das Produktions-Supabase-Projekt"-Punkt makes
// a Supabase-Auth-mailer-backed form unreliable right now; a
// dependency-free mailto: link is what the ticket's AK leans toward as
// the simpler V1 default).
import { useState } from "react";
import Link from "next/link";
import { support, t, type Lang } from "@/lib/i18n";
import { primaryButtonClass } from "@/lib/ui/button-styles";

// Placeholder support mailbox — tiqloo.com is the real production domain
// (TimTracker-Web/README.md's "Produktions-Deployment"-Abschnitt), but
// this exact mailbox has NOT been confirmed to exist/receive mail by a
// human. Flagged in this ticket's report; replace with the real,
// human-confirmed address before shipping.
const SUPPORT_EMAIL = "support@tiqloo.com";

// Same three shared tokens as SettingsClient.tsx/ProjectsClient.tsx —
// deliberately duplicated here rather than imported, matching this
// repo's existing convention (neither of those two exports them either;
// every Client Component that needs them redefines the exact same
// strings locally).
const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

// RFC 6068 mailto: URIs use percent-encoding directly in the query part,
// NOT application/x-www-form-urlencoded (which URLSearchParams produces,
// encoding spaces as "+" — technically wrong here, some mail clients
// mishandle it), hence a plain encodeURIComponent join instead of
// URLSearchParams.
function buildMailto(subject: string, body: string): string {
  const parts = [`subject=${encodeURIComponent(subject)}`];
  if (body.trim().length > 0) {
    parts.push(`body=${encodeURIComponent(body)}`);
  }
  return `mailto:${SUPPORT_EMAIL}?${parts.join("&")}`;
}

export function SupportClient({ lang, displayName }: { lang: Lang; displayName: string }) {
  return (
    <div className="flex flex-col gap-10 py-8">
      <Greeting lang={lang} displayName={displayName} />
      <RequestBox lang={lang} />
      <QuickLinks lang={lang} />
      <SupportFooter lang={lang} />
    </div>
  );
}

// Edge case (ticket AK): "Sehr langer Anzeigename in der Begrüßung ->
// gleiche truncate-Regel wie in der Nav (Ticket 024), kein Layout-Bruch"
// — same min-w-0 + truncate shape as DashboardNav.tsx's identity display,
// just inside a flex heading instead of a flex header row.
function Greeting({ lang, displayName }: { lang: Lang; displayName: string }) {
  return (
    <h1 className="flex min-w-0 items-baseline gap-1 text-[34px] font-semibold tracking-tight">
      <span className="min-w-0 truncate" title={displayName}>
        {displayName}
      </span>
      <span className="shrink-0">{t(lang, support.greetingSuffix)}</span>
    </h1>
  );
}

function RequestBox({ lang }: { lang: Lang }) {
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // No backend to POST to for this ticket — submitting just opens the
    // user's mail client with a pre-filled message. See the module
    // comment above for why mailto: is the deliberate V1 choice.
    window.location.href = buildMailto(t(lang, support.requestMailSubject), message);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground/70">{t(lang, support.requestTitle)}</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="support-request-message" className="text-sm font-medium">
            {t(lang, support.requestLabel)}
          </label>
          <textarea
            id="support-request-message"
            rows={5}
            placeholder={t(lang, support.requestPlaceholder)}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButtonClass}>
            {t(lang, support.requestSubmit)}
          </button>
          {/* Edge case (ticket AK): "Absenden ohne konfigurierten
              Mail-Client -> Nutzer sieht zumindest die Ziel-Adresse als
              sichtbaren Text daneben, nicht nur als unsichtbaren
              Link-Href" — this span is that visible text, independent of
              whether mailto: actually opened anything. */}
          <span className="text-sm text-foreground/60">
            {t(lang, support.requestSendsTo)} <span className="font-mono">{SUPPORT_EMAIL}</span>
          </span>
        </div>
        <p className="text-xs text-foreground/50">{t(lang, support.requestFallbackHint)}</p>
      </form>
    </section>
  );
}

// Adapted from the Personio reference per the ticket's AK: "Kontoinhaber"
// (B2B, multi-user-per-company concept) dropped entirely — no equivalent
// in TimTracker's one-person accounts — replaced with a direct
// Einstellungen link instead, as the ticket explicitly suggests.
// "Support-Historie" also dropped: only makes sense together with a real
// submitted-requests table, which this mailto:-only ticket doesn't build
// (see the ticket's AK for this exact call).
function QuickLinks({ lang }: { lang: Lang }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground/70">{t(lang, support.quickLinksTitle)}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={buildMailto(t(lang, support.feedbackMailSubject), "")}
          className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 text-left transition-colors duration-150 hover:bg-paper"
        >
          <span className="text-sm font-medium">{t(lang, support.feedbackTitle)}</span>
          <span className="text-sm text-foreground/60">{t(lang, support.feedbackBody)}</span>
        </a>
        <Link
          href="/dashboard/settings"
          className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 transition-colors duration-150 hover:bg-paper"
        >
          <span className="text-sm font-medium">{t(lang, support.settingsQuickLinkTitle)}</span>
          <span className="text-sm text-foreground/60">{t(lang, support.settingsQuickLinkBody)}</span>
        </Link>
      </div>
    </section>
  );
}

function SupportFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="flex flex-wrap gap-4 border-t border-line pt-4 text-sm text-foreground/70">
      <Link
        href="/dashboard/support/helpcenter"
        className="transition-colors duration-150 hover:text-foreground"
      >
        {t(lang, support.footerHelpcenter)}
      </Link>
      <Link
        href="/dashboard/support/changelog"
        className="transition-colors duration-150 hover:text-foreground"
      >
        {t(lang, support.footerChangelog)}
      </Link>
    </footer>
  );
}
