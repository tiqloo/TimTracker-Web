// Shared day-detail rendering — hero automatic-time number, a visual
// day-timeline, and the flat chronological entry list. Used by both
// app/(dashboard)/dashboard/page.tsx ("Heute") and
// app/(dashboard)/dashboard/history/[day]/page.tsx (an arbitrary past day):
// the spec (Ticket 001/003 in TimTracker-Starter, Ticket 018 itself) says a
// past day should render in the SAME layout as "Heute", not a separate
// design.
// Deliberately a plain presentational component — it takes already-fetched
// data, not a Repositories instance, so it stays usable from any Server
// Component regardless of which application function fetched the data
// (getTodayBreakdown/getTodayEntries vs. getBreakdownForDay/getEntriesForDay).
//
// Redesigned for Ticket 033 (TimTracker-Starter repo): previously three
// equal-weight SummaryTiles (grid-cols-3, identical typography) followed by
// a flat `ul` of Start–Ende/Dauer rows and nothing else — user feedback
// (quoted in the ticket) called this "too little happens visually" and
// asked for Automatikzeit gesamt to become a dominant hero number with a
// segmented visual timeline underneath. The three numbers' underlying data
// (breakdown.totalSeconds/projectSeconds/unassignedSeconds) and the entry
// list's data (entries, formatTime/formatDuration) are UNCHANGED — this is
// a pure display restructuring, no new formulas.
//
// Ticket 044 (follow-up to 033): adds an OPTIONAL goal-progress caption +
// thin bar directly under the hero number, driven by the new
// `dailyGoalHours` prop — only "Heute" passes it (see that prop's own
// comment below for why), everything else about this component's shape
// is unchanged.
import { formatDuration, formatTime } from "@/lib/format";
import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";
import { languageCodeToLocale } from "@/lib/domain/language";
import { computeDailyGoalProgress } from "@/lib/domain/daily-goal";
import { dayDetail, dayDetailSegmentTooltip, dailyGoalProgressLabel, t, type Lang } from "@/lib/i18n";

// The two system pseudo-projects seeded by supabase/migrations/0001_init.sql
// / 0004_time_entries_project_fk.sql in TimTracker-Starter — every
// time_entries row belongs to one of these two, or a real customer project.
// Same constants Domain/Models/Project.swift uses
// (standardProjectID/pauseProjectID) and the matching constants in
// lib/repositories/supabase/time-entries.repository.ts. Duplicated here as
// literals rather than imported — same precedent as
// lib/application/export.ts's SYSTEM_PROJECT_NAMES map, which does the
// same thing for the same reason: components/ sits one layer above
// lib/application/*, and the Hexagonal boundary (CLAUDE.md) means it must
// never reach into lib/repositories/supabase/* (an adapter) directly.
// These two well-known IDs are effectively part of the domain contract,
// not adapter internals — keep in sync if they ever change.
const STANDARD_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const PAUSE_PROJECT_ID = "00000000-0000-0000-0000-000000000002";

// Below this width a segment stops being legibly hoverable — the Ticket
// 033 edge case ("sehr viele kurze Einträge... Mindestbreite pro Segment
// mit Tooltip"). Applied as a CSS `minWidth` floor on top of a
// flex-grow-proportional width, not a hard pixel layout, so a normal day
// with few, long entries still fills the full available width exactly
// proportionally — only a day with many short entries starts overflowing
// (into the surrounding `overflow-x-auto`) once minWidths stop fitting.
const MIN_SEGMENT_WIDTH_PX = 10;
const MIN_GAP_WIDTH_PX = 3;

type SegmentKind = "auto" | "project" | "pause";

function segmentKind(entry: TimeEntry): SegmentKind {
  if (entry.projectId === PAUSE_PROJECT_ID) return "pause";
  if (entry.projectId === STANDARD_PROJECT_ID) return "auto";
  return "project";
}

// --chart-standard (blue) / --chart-project (orange) are the established,
// reused-everywhere tokens for automatic vs. project time (see
// components/HistoryChart.tsx and app/page.tsx's marketing-homepage
// DayTimeline, which already renders this exact three-way color language:
// auto = --chart-standard, project = --chart-project, anything else =
// the neutral --line hairline token). Pause reuses that same neutral
// --line token rather than inventing a third accent color — consistent
// with how the homepage's "idle" gap segments already use it for "not
// tracked work" time.
function segmentColorVar(kind: SegmentKind): string {
  switch (kind) {
    case "auto":
      return "var(--chart-standard)";
    case "project":
      return "var(--chart-project)";
    case "pause":
      return "var(--line)";
  }
}

interface EntrySegment {
  type: "entry";
  key: string;
  kind: SegmentKind;
  startMs: number;
  endMs: number;
  entry: TimeEntry;
  isRunning: boolean;
}

interface GapSegment {
  type: "gap";
  key: string;
  startMs: number;
  endMs: number;
}

type TimelineSegment = EntrySegment | GapSegment;

// Builds the ordered segment list the visual timeline renders: one segment
// per entry (classified auto/project/pause), plus a synthetic "gap"
// segment for any real elapsed time between two entries (e.g. the Mac was
// asleep/logged out) — without these, entries would sit flush against each
// other and the bar would stop representing actual chronological
// proportions "über die Tageszeitachse" (AK), the entire point of this
// timeline. Mirrors the app/page.tsx marketing homepage's DayTimeline
// gap-as-muted-sliver treatment, not a blank space (same reasoning as
// Ticket 002's "0-Balken statt Lücke" bar-chart rule: a gap in a timeline
// reads as "missing data", a muted sliver reads as "checked, nothing
// happened").
function buildTimeline(entries: TimeEntry[], nowMs: number): TimelineSegment[] {
  const sorted = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const segments: TimelineSegment[] = [];
  let cursorMs: number | null = null;

  for (const entry of sorted) {
    const startMs = new Date(entry.startTime).getTime();
    const endMs = entry.endTime ? new Date(entry.endTime).getTime() : nowMs;
    if (cursorMs !== null && startMs > cursorMs) {
      segments.push({ type: "gap", key: `gap-${entry.id}`, startMs: cursorMs, endMs: startMs });
    }
    segments.push({
      type: "entry",
      key: entry.id,
      kind: segmentKind(entry),
      startMs,
      endMs,
      entry,
      isRunning: entry.endTime === null,
    });
    cursorMs = cursorMs === null ? endMs : Math.max(cursorMs, endMs);
  }
  return segments;
}

export function DayDetail({
  breakdown,
  entries,
  nowMs,
  emptyMessage,
  emptyMessageDetail,
  lang,
  dailyGoalHours,
}: {
  breakdown: DailyBreakdown;
  entries: TimeEntry[];
  nowMs: number;
  emptyMessage: string;
  emptyMessageDetail: string;
  lang: Lang;
  // Ticket 044 (follow-up to 033) — optional, only "Heute"
  // (app/(dashboard)/dashboard/page.tsx) passes this today; the "Historie"
  // day-detail page leaves it undefined on purpose (ticket's AK scopes the
  // progress indicator to "Heute" specifically, see its "Bewusst außerhalb
  // dieses Tickets" section for the related-but-separate history/period
  // comparison idea). undefined/null/0 all mean "no goal set" — see
  // lib/domain/daily-goal.ts#computeDailyGoalProgress, which is what
  // actually decides whether any progress UI renders below.
  dailyGoalHours?: number | null;
}) {
  // Ticket 038: formatDuration/formatTime now take the same locale
  // convention as formatDayLabel/formatFullDate (lib/format.ts) — derived
  // once here from the `lang` prop this component already receives from
  // both callers ("Heute" and the "Historie" day-detail page), same
  // languageCodeToLocale() helper those pages already use for
  // formatDayLabel/formatFullDate.
  const locale = languageCodeToLocale(lang);

  // Empty state (Ticket 033 AK): no hero number, no timeline — a giant
  // "0 h 0 min" hero would read as broken, not as "nothing tracked yet".
  // Just the two-line explanation (headline + detail, both from the
  // dayDetail i18n namespace via each caller's emptyMessage/
  // emptyMessageDetail props).
  //
  // Ticket 044 edge case ("Ziel gesetzt, aber 0 Einträge heute ->
  // Fortschrittsbalken zeigt 0%, kein Fehlerzustand, konsistent mit dem in
  // Ticket 033 überarbeiteten Empty State"): deliberately does NOT grow a
  // goal-progress bar into this branch. "Consistent with the Ticket 033
  // empty state" means this exact two-line shape stays as-is; a 0%-filled
  // bar under an otherwise-hidden hero number would look like a stray UI
  // fragment, not a calmer empty state. computeDailyGoalProgress naturally
  // returns a 0-ratio (not NaN/an error) for totalSeconds=0 if this branch
  // is ever removed later — nothing here relies on entries.length===0 to
  // avoid a crash, it's a pure display choice.
  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-line p-4">
        <p className="text-sm text-foreground/80">{emptyMessage}</p>
        <p className="text-sm text-foreground/60">{emptyMessageDetail}</p>
      </div>
    );
  }

  const timeline = buildTimeline(entries, nowMs);

  // Ticket 044: null whenever no goal is set (dailyGoalHours undefined/
  // null/0) — see computeDailyGoalProgress's own doc. Kept out of the
  // hero number itself (AK: "die Hero-Zahl selbst bleibt die dominante
  // Aussage, der Fortschrittsbalken ist sekundär") — rendered as a small
  // caption + thin bar right underneath it instead.
  const goalProgress = computeDailyGoalProgress(
    breakdown.totalSeconds,
    dailyGoalHours ?? null,
  );

  return (
    <>
      {/* Hero: Automatikzeit gesamt is the one optically dominant number
          (Ticket 033 AK) — Projektzeit/Nicht-zugeordnet drop to a small
          caption row underneath instead of two equal-weight tiles. */}
      <section className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-foreground/60 uppercase">
          {t(lang, dayDetail.totalAutomaticTime)}
        </p>
        <p className="font-mono text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
          {formatDuration(breakdown.totalSeconds, locale)}
        </p>
        {goalProgress && (
          <div className="mt-1 flex max-w-xs flex-col gap-1.5">
            <p className="text-sm text-foreground/70">
              {dailyGoalProgressLabel(
                lang,
                formatDuration(breakdown.totalSeconds, locale),
                formatDuration(goalProgress.goalSeconds, locale),
              )}
              {goalProgress.reached && <> · {t(lang, dayDetail.goalReached)}</>}
            </p>
            <div
              role="progressbar"
              aria-label={t(lang, dayDetail.goalProgressAriaLabel)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(goalProgress.ratio * 100)}
              className="h-1.5 w-full overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full rounded-full bg-chart-standard"
                style={{ width: `${goalProgress.ratio * 100}%` }}
              />
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <SecondaryStat
            swatchClassName="bg-chart-project"
            label={t(lang, dayDetail.projectTime)}
            value={formatDuration(breakdown.projectSeconds, locale)}
          />
          <SecondaryStat
            swatchClassName="bg-chart-standard"
            label={t(lang, dayDetail.unassignedTime)}
            value={formatDuration(breakdown.unassignedSeconds, locale)}
          />
        </div>
      </section>

      {/* Visual day timeline (Ticket 033 AK): every entry as a horizontal
          segment positioned/sized proportionally to real elapsed time, not
          just a text row. aria-hidden — the entries list right below
          already gives the full accessible, exact-value textual
          equivalent, so this stays a decorative supplement rather than a
          second thing a screen reader announces. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground/70">{t(lang, dayDetail.entries)}</h2>
        <div className="overflow-x-auto rounded-md border border-line" aria-hidden="true">
          <div className="flex h-8 min-w-full">
            {timeline.map((segment) => {
              if (segment.type === "gap") {
                return (
                  <div
                    key={segment.key}
                    style={{
                      flexGrow: Math.max(1, segment.endMs - segment.startMs),
                      flexShrink: 0,
                      flexBasis: 0,
                      minWidth: MIN_GAP_WIDTH_PX,
                      backgroundColor: "var(--line)",
                    }}
                  />
                );
              }
              const { entry, kind, isRunning } = segment;
              const durationLabel = formatDuration(
                (segment.endMs - segment.startMs) / 1000,
                locale,
              );
              const kindLabel =
                kind === "pause"
                  ? t(lang, dayDetail.pauseTime)
                  : kind === "project"
                    ? t(lang, dayDetail.projectTime)
                    : t(lang, dayDetail.unassignedTime);
              const endLabel = entry.endTime
                ? formatTime(entry.endTime, locale)
                : t(lang, dayDetail.running);
              return (
                <div
                  key={segment.key}
                  title={dayDetailSegmentTooltip(
                    kindLabel,
                    formatTime(entry.startTime, locale),
                    endLabel,
                    durationLabel,
                  )}
                  className="relative"
                  style={{
                    flexGrow: Math.max(1, segment.endMs - segment.startMs),
                    flexShrink: 0,
                    flexBasis: 0,
                    minWidth: MIN_SEGMENT_WIDTH_PX,
                    backgroundColor: segmentColorVar(kind),
                  }}
                >
                  {isRunning && (
                    <span className="absolute top-1/2 right-0.5 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-background ring-2 ring-background/70" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-line border-t border-line">
          {timeline
            .filter((segment): segment is EntrySegment => segment.type === "entry")
            .map((segment) => (
              <li
                key={segment.key}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  {/* --line is a light hairline token — plenty visible as a
                      wide timeline fill above, but nearly invisible as an
                      8px dot on --background. The neutral border (already
                      the established text-foreground/NN opacity idiom used
                      throughout this codebase) keeps the pause dot readable
                      as "a third, distinct marker" without introducing a
                      new named color. */}
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full border border-foreground/15"
                    style={{ backgroundColor: segmentColorVar(segment.kind) }}
                  />
                  <span className="font-mono tabular-nums">
                    {formatTime(segment.entry.startTime, locale)} –{" "}
                    {segment.entry.endTime
                      ? formatTime(segment.entry.endTime, locale)
                      : t(lang, dayDetail.running)}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-foreground/70">
                  {formatDuration((segment.endMs - segment.startMs) / 1000, locale)}
                </span>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}

function SecondaryStat({
  swatchClassName,
  label,
  value,
}: {
  swatchClassName: string;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-foreground/70">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${swatchClassName}`} />
      {label}
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </span>
  );
}
