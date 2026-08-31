import { getRepositories } from "@/lib/application/server";
import { getHistory, isoToday } from "@/lib/application/dashboard";
import { getExportRows } from "@/lib/application/export";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { canUseApp } from "@/lib/domain/subscription";
import { formatDayLabel, resolveHistoryRange } from "@/lib/format";
import { renderHistoryExportPdf } from "@/lib/pdf/history-export-document";

// PDF export for "Historie" — sibling of ../route.ts's CSV export, same
// access gate, same date-range resolution, same ExportRow/DailyBreakdown
// data (getExportRows/getHistory), just a different rendering target.
// Kept as a separate route (rather than a `?format=pdf` branch on the CSV
// route) so each handler stays a single content type/filename, per the
// ticket's own "not binding" suggestion of either approach.
//
// Rendered via @react-pdf/renderer (lib/pdf/history-export-document.tsx),
// server-side, no headless browser — layout/content mirrors the native
// app's PDFExporter.swift/HistoryExportPageView.swift (header with
// period + totals, the same flat table as CSV, page break per month for
// long ranges). See that file's own comments for the full mapping.
export const runtime = "nodejs";

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

  const periodLabel = `${formatDayLabel(from)} – ${formatDayLabel(to)}`;
  const pdf = await renderHistoryExportPdf(rows, summaries, periodLabel);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="TimTracker-Export-${from}_${to}.pdf"`,
    },
  });
}
