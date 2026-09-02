// "Historie" PDF export — mirrors Integrations/PDF/HistoryExportPageView.swift
// + PDFExporter.swift's page-assembly, rebuilt against @react-pdf/renderer
// (no headless browser in a Vercel function, per the ticket's technical
// suggestion) instead of SwiftUI/NSHostingView, which has no web
// equivalent. Same content/layout as the native app: a header area
// (title, period, three total tiles) on the first page only, a
// "(Fortsetzung)" sub-header on continuation pages, the identical flat
// table used by the CSV export (ExportRow, see lib/application/export.ts),
// and a page per paginateHistoryExport() chunk (page break per month or
// row-count overflow, see history-export-paginator.ts).
//
// Pure rendering over already-fetched data (rows/summaries), no
// Repositories access — same category as lib/format.ts's
// formatHistoryCsv, so this lives outside lib/application/* too. Only
// German labels for now: the native app's PDF export is localized via
// ExportLocalization/the app's active language setting (Ticket 015), but
// this web dashboard has no equivalent per-user language preference yet
// for exports (Settings only has an account-deletion/billing section, see
// app/(dashboard)/settings) — matches the rest of this repo's UI, which
// is German-only throughout (see history/page.tsx's hardcoded headings).
// Revisit if/when a language switch lands here.
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ExportRow } from "@/lib/domain/export-row";
import type { DailyBreakdown } from "@/lib/domain/time-entry";
// formatDuration/formatTime gained a `locale` parameter in Ticket 038;
// every call below now passes "de-DE" explicitly rather than relying on
// the default. Unlike lib/format.ts#formatHistoryCsv (which this ticket
// deliberately does NOT touch, per its AK), this document IS affected:
// formatDuration previously always rendered the English "h"/"m"
// abbreviation ("6h 42m") here, even though every other label on this
// page is German (per this file's header comment, "German-only
// throughout"). Ticket 038 fixes that inconsistency too — this document
// now renders the same "6 h 42 min" German duration format the (already
// bilingual) web UI uses in its German locale, still hardcoded to "de-DE"
// since this export has no per-request language input, same as before.
import { formatDuration, formatTime } from "@/lib/format";
import { paginateHistoryExport, type HistoryExportDayChunk } from "./history-export-paginator";

// A4 in points, same as PDFExporter.swift's `pageSize = CGSize(width: 595,
// height: 842)`.
const PAGE_SIZE = { width: 595, height: 842 };

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    color: "#000000",
    backgroundColor: "#ffffff",
  },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  period: { fontSize: 12, color: "#555555", marginBottom: 10 },
  continuationPeriod: { fontSize: 11, color: "#555555", marginBottom: 10 },
  totals: { flexDirection: "row", gap: 24, marginBottom: 10 },
  totalLabel: { fontSize: 9, color: "#555555" },
  totalValue: { fontSize: 13, fontWeight: 600 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#cccccc", marginBottom: 6 },
  headerRow: {
    flexDirection: "row",
    gap: 6,
    fontSize: 9,
    fontWeight: 600,
    color: "#555555",
    marginBottom: 4,
  },
  dayHeading: { fontSize: 11, fontWeight: 600, marginTop: 6, marginBottom: 2 },
  sessionRow: { flexDirection: "row", gap: 6, fontSize: 10, marginBottom: 2 },
  summaryRow: {
    flexDirection: "row",
    gap: 6,
    fontSize: 9,
    fontWeight: 500,
    color: "#555555",
    marginTop: 2,
    marginBottom: 8,
  },
  colProject: { width: "34%" },
  colCustomer: { width: "20%" },
  colStart: { width: "12%" },
  colEnd: { width: "16%" },
  colDuration: { width: "18%", textAlign: "right" },
});

function dayHeadingLabel(isoDay: string): string {
  // "Montag, 24. August 2026" — same shape/order as HistoryExportPageView's
  // `dateFormatter.dateFormat = "EEEE, d. MMMM yyyy"`.
  return new Date(`${isoDay}T00:00:00`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function sumSeconds(summaries: DailyBreakdown[], key: keyof DailyBreakdown): number {
  return summaries.reduce((total, day) => total + (day[key] as number), 0);
}

function TotalTile({ label, seconds }: { label: string; seconds: number }) {
  return (
    <View>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{formatDuration(seconds, "de-DE")}</Text>
    </View>
  );
}

function HeaderRow() {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.colProject}>Projekt</Text>
      <Text style={styles.colCustomer}>Kunde</Text>
      <Text style={styles.colStart}>Start</Text>
      <Text style={styles.colEnd}>Ende</Text>
      <Text style={styles.colDuration}>Dauer</Text>
    </View>
  );
}

function SessionRow({ row }: { row: ExportRow }) {
  const endText = row.isRunning
    ? "läuft noch"
    : row.endTime
      ? formatTime(row.endTime, "de-DE")
      : "";
  return (
    <View style={styles.sessionRow}>
      <Text style={styles.colProject}>{row.projectName}</Text>
      <Text style={styles.colCustomer}>{row.customerName}</Text>
      <Text style={styles.colStart}>{formatTime(row.startTime, "de-DE")}</Text>
      <Text style={styles.colEnd}>{endText}</Text>
      <Text style={styles.colDuration}>{formatDuration(row.durationSeconds, "de-DE")}</Text>
    </View>
  );
}

function SummaryRow({ day }: { day: DailyBreakdown }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.colProject}>Zusammenfassung</Text>
      <Text style={styles.colCustomer} />
      <Text style={styles.colStart} />
      <Text style={styles.colEnd} />
      <Text style={{ width: "18%", textAlign: "right" }}>
        {`A: ${formatDuration(day.standardSeconds, "de-DE")}  P: ${formatDuration(day.projectSeconds, "de-DE")}  N: ${formatDuration(day.unassignedSeconds, "de-DE")}`}
      </Text>
    </View>
  );
}

function ExportPage({
  periodLabel,
  isFirstPage,
  grandTotal,
  dayChunks,
}: {
  periodLabel: string;
  isFirstPage: boolean;
  grandTotal: { standardSeconds: number; projectSeconds: number; unassignedSeconds: number };
  dayChunks: HistoryExportDayChunk[];
}) {
  return (
    <Page size={PAGE_SIZE} style={styles.page}>
      {isFirstPage ? (
        <>
          <Text style={styles.title}>Tiqloo – Zeitbericht</Text>
          <Text style={styles.period}>{periodLabel}</Text>
          <View style={styles.totals}>
            <TotalTile label="Automatikzeit" seconds={grandTotal.standardSeconds} />
            <TotalTile label="Projektzeit" seconds={grandTotal.projectSeconds} />
            <TotalTile label="Nicht zugeordnet" seconds={grandTotal.unassignedSeconds} />
          </View>
        </>
      ) : (
        <Text style={styles.continuationPeriod}>{`${periodLabel} (Fortsetzung)`}</Text>
      )}
      <View style={styles.divider} />

      <HeaderRow />

      {dayChunks.map((chunk) => (
        <View key={chunk.day.day} wrap={false}>
          <Text style={styles.dayHeading}>{dayHeadingLabel(chunk.day.day)}</Text>
          {chunk.rows.map((row) => (
            <SessionRow key={row.id} row={row} />
          ))}
          <SummaryRow day={chunk.day} />
        </View>
      ))}
    </Page>
  );
}

export function HistoryExportDocument({
  rows,
  summaries,
  periodLabel,
}: {
  rows: ExportRow[];
  summaries: DailyBreakdown[];
  periodLabel: string;
}) {
  const grandTotal = {
    standardSeconds: sumSeconds(summaries, "standardSeconds"),
    projectSeconds: sumSeconds(summaries, "projectSeconds"),
    unassignedSeconds: sumSeconds(summaries, "unassignedSeconds"),
  };

  const pages = paginateHistoryExport(rows, summaries);

  return (
    <Document>
      {pages.length === 0 ? (
        // Empty period → header-only page with 0h totals, no error — same
        // fallback as PDFExporter.swift's `if pages.isEmpty { append(...) }`.
        <ExportPage periodLabel={periodLabel} isFirstPage grandTotal={grandTotal} dayChunks={[]} />
      ) : (
        pages.map((dayChunks, index) => (
          <ExportPage
            key={dayChunks[0]?.day.day ?? index}
            periodLabel={periodLabel}
            isFirstPage={index === 0}
            grandTotal={grandTotal}
            dayChunks={dayChunks}
          />
        ))
      )}
    </Document>
  );
}

// Thin wrapper the Route Handler calls (app/(dashboard)/dashboard/history/
// export/pdf/route.ts) so it doesn't need to know about @react-pdf/renderer
// or JSX itself — keeps the actual rendering entirely in this module, same
// separation as formatHistoryCsv/export/route.ts for the CSV export.
export async function renderHistoryExportPdf(
  rows: ExportRow[],
  summaries: DailyBreakdown[],
  periodLabel: string,
): Promise<Buffer> {
  return renderToBuffer(
    <HistoryExportDocument rows={rows} summaries={summaries} periodLabel={periodLabel} />,
  );
}
