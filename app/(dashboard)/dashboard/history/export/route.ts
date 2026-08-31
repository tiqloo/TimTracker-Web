import { getRepositories } from "@/lib/application/server";
import { getHistory, isoToday } from "@/lib/application/dashboard";
import { getExportRows } from "@/lib/application/export";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { canUseApp } from "@/lib/domain/subscription";
import { formatHistoryCsv, resolveHistoryRange } from "@/lib/format";

// CSV export for "Historie" — same column structure as CSVExporter.swift
// (Datum, Projekt, Kunde, Start, Ende, Dauer (h) per session, plus a daily
// summary row). A plain Route Handler rather than a page: the browser (or
// curl) downloads this directly via the "Als CSV exportieren" link in
// history/page.tsx, no client-side JS needed to trigger it.
//
// PDF export (mirroring PDFExporter.swift/HistoryExportPageView.swift in
// the native app) lives at the sibling route ./pdf/route.ts, via
// lib/pdf/history-export-document.tsx (@react-pdf/renderer, no headless
// browser) — Ticket 021. Kept as a separate route rather than a
// `?format=pdf` branch here so each handler stays a single content type.
export async function GET(request: Request) {
  const repos = await getRepositories();

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return new Response(
      "Kein aktiver Testzeitraum oder Abo mehr. Bitte Abo verwalten, um wieder auf deine Daten zuzugreifen.",
      { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const url = new URL(request.url);
  const { from, to } = resolveHistoryRange(isoToday(), {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const [summaries, rows] = await Promise.all([
    getHistory(repos, from, to),
    getExportRows(repos, from, to),
  ]);

  const csv = formatHistoryCsv(rows, summaries);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="TimTracker-Export-${from}_${to}.csv"`,
    },
  });
}
