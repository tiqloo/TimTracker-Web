import { getRepositories } from "@/lib/application/server";
import { isoToday } from "@/lib/application/dashboard";
import { getHistoryExportData } from "@/lib/application/export";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { canUseApp } from "@/lib/domain/subscription";
import { formatHistoryCsv, resolveHistoryRange } from "@/lib/format";
import { requireUser } from "@/lib/application/auth";
import { ForbiddenError } from "@/lib/domain/application-error";
import { routeErrorResponse } from "@/lib/http/route-error";

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
  try {
    return await createCsvExportResponse(request);
  } catch (error) {
    return routeErrorResponse(error, "history_csv_export");
  }
}

async function createCsvExportResponse(request: Request): Promise<Response> {
  const repos = await getRepositories();
  await requireUser(repos);

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    throw new ForbiddenError("An active subscription is required for this export.");
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
