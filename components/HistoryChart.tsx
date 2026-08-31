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
import type { ChartBar, ChartGranularity } from "@/lib/format";
import { formatDuration } from "@/lib/format";

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
}: {
  bars: ChartBar[];
  granularity: ChartGranularity;
}) {
  if (bars.length === 0) return null;

  const maxTotal = Math.max(1, ...bars.map((b) => b.standardSeconds + b.projectSeconds));
  const scale = (CHART_HEIGHT - ZERO_SLIVER_HEIGHT) / maxTotal;
  const labelStep = Math.max(1, Math.ceil(bars.length / MAX_VISIBLE_LABELS));
  const svgWidth = bars.length * (BAR_WIDTH + BAR_GAP);

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-3 flex items-center gap-4 font-mono text-xs text-foreground/60">
        <Legend swatchClassName="bg-chart-standard" label="Automatikzeit" />
        <Legend swatchClassName="bg-chart-project" label="Projektzeit" />
        <span className="ml-auto">
          {granularity === "day" ? "Tageswerte" : "Monatswerte (aggregiert)"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={`Balkendiagramm Automatikzeit vs. Projektzeit, ${
            granularity === "day" ? "pro Tag" : "pro Monat"
          }`}
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

            const tooltip = `${bar.label}: Automatik ${formatDuration(
              bar.standardSeconds,
            )}, Projekt ${formatDuration(bar.projectSeconds)}`;

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
                        className="fill-chart-project"
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
    </div>
  );
}

function Legend({ swatchClassName, label }: { swatchClassName: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${swatchClassName}`} />
      {label}
    </span>
  );
}
