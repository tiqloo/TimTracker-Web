"use client";

// Shared day-detail rendering — hero automatic-time number, a visual
// day-timeline, and the flat chronological entry list. Used by both
// app/(dashboard)/dashboard/page.tsx ("Heute") and
// app/(dashboard)/dashboard/history/[day]/page.tsx (an arbitrary past day):
// the spec (Ticket 001/003 in TimTracker-Starter, Ticket 018 itself) says a
// past day should render in the SAME layout as "Heute", not a separate
// design.
// Takes already-fetched data as props (not a Repositories instance), so it
// stays usable from any Server Component regardless of which application
// function fetched the initial data (getTodayBreakdown/getTodayEntries vs.
// getBreakdownForDay/getEntriesForDay) — a Server Component can render a
// Client Component directly with serializable props, which is all
// breakdown/entries/nowMs/lang are.
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
// Ticket 040 (TimTracker-Starter repo): the timeline's "project" segments
// (both the bar and the entry-list dot) now color themselves with the
// actual project's own `colorHex` instead of a flat shared token — see
// segmentColorVar()/`projectColors` prop below. Layout is otherwise
// unchanged; this ticket deliberately owns color logic only, not another
// restructuring pass on top of Ticket 033's finished layout.
//
// Promoted from a plain presentational (Server-renderable) component to a
// Client Component for Ticket 034 ("Nicht zugeordnete Zeit" -> Projekt
// zuordnen): the AK requires the timeline AND the hero/secondary numbers to
// update immediately after a successful assign, without a full page
// reload — that needs local React state (entries/breakdown), which needs
// "use client". The `breakdown`/`entries` props below are now only the
// INITIAL server-fetched values (still fetched exactly as before by each
// caller's Server Component) — see the useState calls below.
//
// Ticket 044 (follow-up to 033): adds an OPTIONAL goal-progress caption +
// thin bar directly under the hero number, driven by the new
// `dailyGoalHours` prop — only "Heute" passes it (see that prop's own
// comment below for why), everything else about this component's shape
// is unchanged.
import { useEffect, useState } from "react";
import { formatDuration, formatTime } from "@/lib/format";
import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";
import type { Project } from "@/lib/domain/project";
import { languageCodeToLocale } from "@/lib/domain/language";
import { getRepositories } from "@/lib/application/client";
import { listProjects } from "@/lib/application/projects";
import { AssignTimeAction } from "@/components/AssignTimeAction";
import { computeDailyGoalProgress } from "@/lib/domain/daily-goal";
import {
  dayDetail,
  dayDetailSegmentTooltip,
  dailyGoalProgressLabel,
  t,
  type Lang,
} from "@/lib/i18n";

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
// tracked work" time. Auto/pause segments are never real projects (they're
// the two system pseudo-projects, see STANDARD_PROJECT_ID/PAUSE_PROJECT_ID
// above) so they intentionally keep these flat, neutral tokens rather than
// getting a per-project color (Ticket 040 edge case: no regression here).
//
// Ticket 040: a "project" segment now renders the actual project's own
// `colorHex` (the same value ColorSwatch in ProjectsClient.tsx already
// renders as a small dot in the projects list) instead of the flat
// `--chart-project` orange every project previously shared — that's the
// whole point of this ticket ("dieselbe Farbe ... auf Timeline, Historie,
// Reports und Tagesübersicht"). `--chart-project` stays the fallback for
// the (defensive-only) case a project's color isn't in `projectColors` —
// e.g. a data race between an entry and a since-deleted project row —
// so a segment never silently renders unstyled.
function segmentColorVar(kind: SegmentKind, projectColorHex?: string): string {
  switch (kind) {
    case "auto":
      return "var(--chart-standard)";
    case "project":
      return projectColorHex ? `#${projectColorHex}` : "var(--chart-project)";
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

// Ticket 034: recomputes a DailyBreakdown from an up-to-date entries array
// after a successful assign — same formula, same field-by-field meaning as
// buildBreakdown() in lib/repositories/supabase/time-entries.repository.ts
// (standardSeconds/projectSeconds/pauseSeconds from segmentKind() above,
// totalSeconds excludes pause, unassignedSeconds = max(0, total -
// project)). Deliberately duplicated here rather than imported — same
// precedent and same reasoning as STANDARD_PROJECT_ID/PAUSE_PROJECT_ID at
// the top of this file: components/ sits one layer above
// lib/application/*, and the Hexagonal boundary means it must never reach
// into lib/repositories/supabase/* (an adapter) directly. Keep in sync if
// the formula ever changes — same "single formula, three call sites"
// obligation the adapter's own comment already documents.
function computeBreakdown(day: string, entries: TimeEntry[], nowMs: number): DailyBreakdown {
  let standardSeconds = 0;
  let projectSeconds = 0;
  let pauseSeconds = 0;

  for (const entry of entries) {
    const start = new Date(entry.startTime).getTime();
    const end = entry.endTime ? new Date(entry.endTime).getTime() : nowMs;
    const seconds = Math.max(0, Math.round((end - start) / 1000));
    const kind = segmentKind(entry);
    if (kind === "pause") pauseSeconds += seconds;
    else if (kind === "auto") standardSeconds += seconds;
    else projectSeconds += seconds;
  }

  const totalSeconds = standardSeconds + projectSeconds;
  return {
    day,
    standardSeconds,
    projectSeconds,
    pauseSeconds,
    totalSeconds,
    unassignedSeconds: Math.max(0, totalSeconds - projectSeconds),
  };
}

export function DayDetail({
  breakdown: initialBreakdown,
  entries: initialEntries,
  nowMs,
  emptyMessage,
  emptyMessageDetail,
  lang,
  projectColors,
  dailyGoalHours,
}: {
  breakdown: DailyBreakdown;
  entries: TimeEntry[];
  nowMs: number;
  emptyMessage: string;
  emptyMessageDetail: string;
  lang: Lang;
  // Ticket 040: projectId -> colorHex (no leading "#", same convention as
  // Project.colorHex/ColorSwatch) for every real project the caller knows
  // about, including archived ones (Ticket 040 edge case: an archived
  // project's past entries keep showing its color, same as any other
  // domain data — archiving isn't deletion, see lib/domain/project.ts).
  // Only entries whose segmentKind() is "project" ever look this up; the
  // two system pseudo-projects (auto/pause) never do.
  projectColors: Record<string, string>;
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
  // Ticket 034: local, client-side copies of the server-fetched initial
  // props — updated in place after a successful assign (see
  // handleAssigned below) so the timeline and the hero/secondary numbers
  // reflect the change immediately, without a router.refresh()/full page
  // reload. On failure neither of these is ever touched (AssignTimeAction
  // only calls onAssigned on success) — the AK's "Timeline/Kennzahlen
  // bleiben im alten, korrekten Zustand" edge case falls out of that for
  // free, no separate rollback logic needed.
  const [entries, setEntries] = useState(initialEntries);
  const [breakdown, setBreakdown] = useState(initialBreakdown);

  // Real (non-system) projects for the assign dropdown, fetched once,
  // lazily, and shared by every AssignTimeAction instance on this page —
  // not per-row, so a day with several unassigned segments doesn't fire
  // the same request once per segment. `hasUnassignedOnMount` is captured
  // once via a lazy useState initializer specifically so it stays stable
  // across the whole component lifetime even though `breakdown` itself
  // changes after an assign (unassignedSeconds only ever goes down from
  // an assign, never up, so "did this day start with something to
  // assign" is the right, one-time gate for whether to fetch at all —
  // most days have nothing unassigned, and those pay no extra request).
  const [hasUnassignedOnMount] = useState(() => initialBreakdown.unassignedSeconds > 0);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectsError, setProjectsError] = useState(false);

  useEffect(() => {
    if (!hasUnassignedOnMount) return;
    let cancelled = false;
    (async () => {
      try {
        const repos = getRepositories();
        const list = await listProjects(repos);
        if (!cancelled) setProjects(list);
      } catch {
        if (!cancelled) setProjectsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasUnassignedOnMount]);

  function handleAssigned(updated: TimeEntry) {
    const nextEntries = entries.map((entry) => (entry.id === updated.id ? updated : entry));
    setEntries(nextEntries);
    setBreakdown(computeBreakdown(initialBreakdown.day, nextEntries, nowMs));
  }

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
      <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
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
        {/* Ticket 048: structure/segment logic unchanged per the ticket's
            own explicit "NICHT neu bauen" instruction for this timeline —
            rounded-md (6px) bumped to rounded-lg (8px) as the one radius
            touch-up the ticket does ask for ("Radius/Border-Feinschliff"),
            kept modest rather than the full 10-14px card band since this
            is a thin 32px-tall bar, not a card. --line itself already
            picks up its new #E8E8E3 value from globals.css automatically
            (both the border here and every gap/pause segment fill via
            segmentColorVar() below reference the same token, no code
            change needed for those). */}
        <div className="overflow-x-auto rounded-lg border border-line" aria-hidden="true">
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
                    backgroundColor: segmentColorVar(kind, projectColors[entry.projectId]),
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
              <li key={segment.key} className="flex flex-col gap-1.5 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-4">
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
                      style={{
                        backgroundColor: segmentColorVar(
                          segment.kind,
                          projectColors[segment.entry.projectId],
                        ),
                      }}
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
                </div>
                {/* Ticket 034: the "Jetzt zuordnen" action, one per
                    unassigned (kind "auto" — see this file's own top
                    comment: unassigned currently equals all automatic
                    time) entry — placed right at its own row per the
                    ticket's edge case (several non-contiguous unassigned
                    segments on the same day must each be assignable
                    independently, not as one all-or-nothing action). */}
                {segment.kind === "auto" && (
                  <div className="pl-4">
                    <AssignTimeAction
                      entry={segment.entry}
                      projects={projects}
                      projectsError={projectsError}
                      lang={lang}
                      onAssigned={handleAssigned}
                    />
                  </div>
                )}
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
