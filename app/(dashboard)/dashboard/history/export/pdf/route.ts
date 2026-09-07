import { getRepositories } from "@/lib/application/server";
import { isoToday } from "@/lib/application/dashboard";
import { getHistoryExportData } from "@/lib/application/export";
import { getActiveWorkspaceTimeZone } from "@/lib/application/workspace";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { canUseApp } from "@/lib/domain/subscription";
import { formatDayLabel, resolveHistoryRange } from "@/lib/format";
import { renderHistoryExportPdf } from "@/lib/pdf/history-export-document";
import { requireUser } from "@/lib/application/auth";
import { ForbiddenError } from "@/lib/domain/application-error";
import { routeErrorResponse } from "@/lib/http/route-error";

// PDF export for "Historie" — sibling of ../route.ts's CSV export, same
// access gate, same date-range resolution, same ExportRow/DailyBreakdown
// data (getHistoryExportData), just a different rendering target.
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
  try {
    return await createPdfExportResponse(request);
  } catch (error) {
    return routeErrorResponse(error, "history_pdf_export");
  }
}

async function createPdfExportResponse(request: Request): Promise<Response> {
  const repos = await getRepositories();
  await requireUser(repos);

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    throw new ForbiddenError("An active subscription is required for this export.");
  }

  const timeZone = await getActiveWorkspaceTimeZone(repos);
  const url = new URL(request.url);
  const { from, to } = resolveHistoryRange(isoToday(new Date(), timeZone), {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  // Ticket 043: same active-project-filter handling as the sibling CSV
  // route (../route.ts) — validated against the real project list, not
  // just trusted as-is. renderHistoryExportPdf itself doesn't need a new
  // parameter for this (per the ticket's own "PDF-Rendering muss dafür
  // einen optionalen Projekt-Filter entgegennehmen können": its existing
  // `periodLabel` string is already the generic place a filter note
  // belongs — folded in below rather than plumbing a second label prop
  // through lib/pdf/history-export-document.tsx).
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
    timeZone,
  );

  const periodLabel = `${formatDayLabel(from)} – ${formatDayLabel(to)}${
    activeProject ? ` · ${activeProject.name}` : ""
  }`;
  const pdf = await renderHistoryExportPdf(rows, summaries, periodLabel);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Tiqloo-Export-${from}_${to}.pdf"`,
    },
  });
}
