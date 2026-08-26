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
// PDF export (PDFExporter.swift/HistoryExportPageView.swift in the native
// app) is deliberately NOT implemented here — it renders via SwiftUI's
// NSHostingView straight to a PDF context, which has no web equivalent;
// doing this properly server-side would mean pulling in a real PDF-
// generation library (e.g. @react-pdf/renderer or pdf-lib) and rebuilding
// the whole paginated layout (page breaks per month, header/summary tiles,
// HistoryExportPageView's page-chunking logic) against it — a meaningfully
// sized second effort, not a small addition to this phase. CSV already
// covers the core "get my data out" need (opens directly in Excel/Numbers,
// same semicolon-delimited format the native app produces) and is a
// straight text response with no new dependency. Deferred, not dropped —
// tracked as a follow-up in docs/tickets/018-account-website.md's Phase 1c
// section.
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
