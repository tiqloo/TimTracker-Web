// "Historie" bar chart (Ticket 002) — one stacked bar per day (or per
// month at "month" granularity, see lib/format.ts#resolveChartGranularity)
// showing Automatikzeit vs. Projektzeit for the currently selected period.
//
// Stacked, not side-by-side: a grouped/side-by-side layout would need two
// bars per period, doubling the element count right when the AK's own
// "very long period stays performant" edge case matters most (a month
// view already has up to 31 periods — 62 bars grouped vs. 31 stacked).
// Stacking also directly shows total effort for a day as the bar's full
// height, with the Automatik/Projekt split still visible as two colored
// segments — a grouped layout would need a second visual pass to add the
// two segments back together. It also keeps to Ticket 002's own "gleiches
// flaches Kartenlayout ... keine neuen verschachtelten UI-Elemente" spirit:
// one row of bars, not two interleaved series to visually parse.
//
// Hand-rolled SVG/CSS rather than a charting library (e.g. recharts): this
// app has consistently avoided pulling in a dependency where a small
// amount of own code covers it (CSV export, no library; PDF export,
// deliberately deferred rather than adding one — see history/export/
// route.ts). A stacked bar chart with 2 series, zero-fill, and a native
// <title> tooltip is a well-understood, small amount of SVG — nowhere
// near the complexity (interactive zoom, animation, many chart types)
// that would make a library the less-code option. Also avoids a client
// bundle: this stays a plain Server Component, no "use client" needed.
//
// Zero-activity bars: rendered as a short, muted 2px sliver anchored to
// the baseline, not literally 0px tall — a literal 0px bar would be
// visually identical to "no bar at all" (a gap), which is exactly what
// Ticket 002's AK says NOT to do ("zeigen einen 0-Balken statt einer
// Lücke"). The sliver is the smallest way to make "there is a bar here,
// it's empty" visually distinct from "there is no data point here".
//
// Ticket 040 (TimTracker-Starter repo): deliberately did NOT turn the
// "project" segment into a per-project color breakdown in the general
// (unfiltered) case — an unfiltered bar's projectSeconds can mix an
// unbounded number of projects, and stacking that many colors into one
// already-narrow bar was judged unreadable (the ticket's own named risk).
// What IS implemented: once Ticket 043's project filter narrows the whole
// chart to exactly one project, that one project's real `colorHex` now
// replaces the flat `--chart-project` orange for both the legend swatch
// and the project segment fill (see `activeProjectColor` below) — no
// breakdown ambiguity there since there is only ever one project shown.
import type { CSSProperties } from "react";
import type { ChartBar, ChartGranularity } from "@/lib/format";
import { formatDuration } from "@/lib/format";
import { languageCodeToLocale } from "@/lib/domain/language";
import {
  historyChart,
  history,
  historyChartAriaLabel,
  historyChartTooltip,
  t,
  type Lang,
} from "@/lib/i18n";

const CHART_HEIGHT = 160;
const BAR_WIDTH = 18;
const BAR_GAP = 10;
const ZERO_SLIVER_HEIGHT = 2;
const SEGMENT_GAP = 2; // thin surface gap between the two stacked segments

// Beyond this many bars, printing a label under every single one would
// overlap illegibly (this can happen at "day" granularity for a range
// close to the 62-day cutoff) — thin them out to roughly this many
// evenly-spaced labels instead. Bars themselves are still all rendered;
// only axis labels are decimated.
const MAX_VISIBLE_LABELS = 20;

export function HistoryChart({
  bars,
  granularity,
  lang,
  activeProjectName,
  activeProjectColor,
}: {
  bars: ChartBar[];
  granularity: ChartGranularity;
  lang: Lang;
  // Ticket 043: the "Historie" project filter's currently selected
  // project name, if any — the bars themselves are already filtered
  // upstream (history/page.tsx passes a filtered `bars` in either case,
  // this component never filters anything itself), this is purely the
  // visible "you're looking at one project, not the whole period"
  // indicator so a shorter bar doesn't read as "a quiet day".
  activeProjectName?: string;
  // Ticket 040: that same filtered project's own `colorHex` (no leading
  // "#"), if any. Deliberately NOT a general per-project breakdown of the
  // stacked bar — with several projects active in an unfiltered period,
  // one bar can contain time from an unbounded number of projects at
  // once, and a stacked bar with that many colors quickly stops being
  // readable (the exact risk the ticket's AK calls out; see
  // docs/tickets/040-project-colors-reuse.md in TimTracker-Starter for
  // the full reasoning this file's comment intentionally condenses).
  // The unfiltered "project" segment therefore deliberately keeps the
  // flat --chart-project token. But once Ticket 043's filter narrows a
  // bar's whole `projectSeconds` to exactly one, already-named project,
  // there's no ambiguity left to protect against — recoloring that one
  // segment to the real project color is a small, unambiguous win
  // squarely inside this ticket's "same color ... on Historie" goal, so
  // it's implemented here even though the general case above is not.
  activeProjectColor?: string;
}) {
  if (bars.length === 0) return null;

  // Ticket 038: same locale derivation as DayDetail.tsx — the tooltip
  // text below (a11y/hover, not a visible label) uses formatDuration's
  // new locale-aware format instead of always rendering the English
  // "h"/"m" suffixes under a German UI.
  const locale = languageCodeToLocale(lang);
  const maxTotal = Math.max(1, ...bars.map((b) => b.standardSeconds + b.projectSeconds));
  const scale = (CHART_HEIGHT - ZERO_SLIVER_HEIGHT) / maxTotal;
  const labelStep = Math.max(1, Math.ceil(bars.length / MAX_VISIBLE_LABELS));
  const svgWidth = bars.length * (BAR_WIDTH + BAR_GAP);

  return (
    <section className="rounded-2xl border border-line/80 bg-surface/90 p-5 shadow-[0_12px_35px_rgba(22,28,45,0.04)] sm:p-6" aria-labelledby="work-time-trend-title">
      <h2 id="work-time-trend-title" className="mb-4 text-lg font-semibold">{t(lang, history.workTimeTrend)}</h2>
      <div className="mb-3 flex items-center gap-4 font-mono text-xs text-foreground/60">
        <Legend swatchClassName="bg-chart-standard" label={t(lang, historyChart.automaticTime)} />
        <Legend
          swatchClassName={activeProjectColor ? undefined : "bg-chart-project"}
          swatchStyle={activeProjectColor ? { backgroundColor: `#${activeProjectColor}` } : undefined}
          label={t(lang, historyChart.projectTime)}
        />
        <span className="ml-auto flex items-center gap-2">
          {activeProjectName && (
            <span>
              {t(lang, historyChart.filteredByProjectPrefix)} {activeProjectName}
            </span>
          )}
          <span>
            {granularity === "day" ? t(lang, historyChart.dailyValues) : t(lang, historyChart.monthlyValues)}
          </span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={historyChartAriaLabel(lang, granularity)}
          width={svgWidth}
          height={CHART_HEIGHT + 20}
          viewBox={`0 0 ${svgWidth} ${CHART_HEIGHT + 20}`}
          className="min-w-full"
        >
          <line
            x1={0}
            y1={CHART_HEIGHT}
            x2={svgWidth}
            y2={CHART_HEIGHT}
            className="stroke-line"
            strokeWidth={1}
          />
          {bars.map((bar, i) => {
            const x = i * (BAR_WIDTH + BAR_GAP);
            const total = bar.standardSeconds + bar.projectSeconds;
            const isZero = total === 0;
            const standardHeight = bar.standardSeconds * scale;
            const projectHeight = bar.projectSeconds * scale;
            const hasBothSegments = bar.standardSeconds > 0 && bar.projectSeconds > 0;
            const gap = hasBothSegments ? SEGMENT_GAP : 0;

            const tooltip = historyChartTooltip(
              lang,
              bar.label,
              formatDuration(bar.standardSeconds, locale),
              formatDuration(bar.projectSeconds, locale),
            );

            return (
              <g key={bar.key}>
                <title>{tooltip}</title>
                {isZero ? (
                  <rect
                    x={x}
                    y={CHART_HEIGHT - ZERO_SLIVER_HEIGHT}
                    width={BAR_WIDTH}
                    height={ZERO_SLIVER_HEIGHT}
                    rx={1}
                    className="fill-line"
                  />
                ) : (
                  <>
                    {bar.standardSeconds > 0 && (
                      <rect
                        x={x}
                        y={CHART_HEIGHT - standardHeight}
                        width={BAR_WIDTH}
                        height={standardHeight}
                        rx={2}
                        className="fill-chart-standard"
                      />
                    )}
                    {bar.projectSeconds > 0 && (
                      <rect
                        x={x}
                        y={CHART_HEIGHT - standardHeight - projectHeight + (hasBothSegments ? gap : 0)}
                        width={BAR_WIDTH}
                        height={projectHeight - (hasBothSegments ? gap : 0)}
                        rx={2}
                        className={activeProjectColor ? undefined : "fill-chart-project"}
                        fill={activeProjectColor ? `#${activeProjectColor}` : undefined}
                      />
                    )}
                  </>
                )}
                {i % labelStep === 0 && (
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={CHART_HEIGHT + 16}
                    textAnchor="middle"
                    className="fill-foreground/60 font-mono text-[9px]"
                  >
                    {bar.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function Legend({
  swatchClassName,
  swatchStyle,
  label,
}: {
  // Ticket 040: either a Tailwind bg-* token class (the pre-existing
  // path, still used for automaticTime always and projectTime whenever no
  // project filter narrows the bar to one project's real color) or an
  // inline style carrying that project's own colorHex — never both, see
  // the two callsites above.
  swatchClassName?: string;
  swatchStyle?: CSSProperties;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`h-2.5 w-2.5 rounded-sm ${swatchClassName ?? ""}`}
        style={swatchStyle}
      />
      {label}
    </span>
  );
}
