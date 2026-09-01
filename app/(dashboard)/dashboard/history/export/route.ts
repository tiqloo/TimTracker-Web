import { getRepositories } from "@/lib/application/server";
import { isoToday } from "@/lib/application/dashboard";
import { getHistoryExportData } from "@/lib/application/export";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import { formatHistoryCsv, resolveHistoryRange } from "@/lib/format";
import { exportGate, t } from "@/lib/i18n";

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
    const lang = await getEffectiveLanguageCode(repos, request.headers.get("accept-language"));
    return new Response(t(lang, exportGate.noAccess), {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  const { from, to } = resolveHistoryRange(isoToday(), {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  // Ticket 043: carry the "Historie" page's active project filter (if any)
  // into the export. Validated against the real project list (not just
  // "any non-empty string") the same way history/page.tsx does, so a
  // stale/tampered `project` query param can't silently produce a
  // confusing "filtered to nothing" export — it's just ignored instead,
  // same fallback-to-unfiltered behavior as an invalid from/to.
  const requestedProjectId = url.searchParams.get("project")?.trim() || undefined;
  const allProjects = await repos.projects.getAll();
  const activeProject = requestedProjectId
    ? allProjects.find((project) => project.id === requestedProjectId)
    : undefined;
  const projectId = activeProject?.id;

  const { summaries, rows } = await getHistoryExportData(
    repos,
    from,
    to,
    allProjects,
    projectId,
  );

  const csv = formatHistoryCsv(rows, summaries, activeProject?.name);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="TimTracker-Export-${from}_${to}.csv"`,
    },
  });
}
