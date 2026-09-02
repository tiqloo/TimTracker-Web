"use client";

// Ticket 043 — "Historie" calendar-grid date-range picker. Replaces the two
// native <input type="date"> fields history/page.tsx used to render for the
// free date range (the four presets above it are untouched and still work
// with zero JS, see that file's own comments) with a real month-grid,
// click-from/click-to range picker.
//
// Hand-rolled, no external datepicker dependency — per the ticket's own AK
// ("kein neues externes Datepicker-Paket nötig, sofern sich eine einfache
// eigene Lösung ... sauber umsetzen lässt"). The actual surface area this
// needs is small and well-understood (a single month grid, prev/next
// navigation, two-click range selection) — nowhere near the complexity
// (localized parsing, keyboard-nav grids, multiple calendar systems,
// timezone-aware min/max) that would make pulling in react-day-picker or
// similar the less-code option, and this repo has consistently avoided a
// dependency where a small amount of own code covers it (see
// components/HistoryChart.tsx's own header comment for the same call on
// the chart itself, and lib/format.ts's formatHistoryCsv for CSV export).
//
// Deliberately a Client Component (unlike the rest of this page, which
// stays server-rendered plain links/forms) — real click-to-select-range
// interaction with in-place month browsing needs local state that doesn't
// round-trip through the server on every click. Graceful degradation
// without JS: the four presets (plain <Link>s) and the project-filter
// <select> (a plain GET <form>) both keep working; only this specific
// "pick an arbitrary custom range via a calendar" affordance needs JS,
// same as it would with any date-picker, hand-rolled or not.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { common, history, t, type Lang } from "@/lib/i18n";
import { primaryButtonSmallClass, secondaryButtonSmallClass } from "@/lib/ui/button-styles";

interface HistoryDateRangePickerProps {
  from: string;
  to: string;
  projectId?: string;
  lang: Lang;
  locale: string;
  basePath?: string;
}

// Same eslint react-hooks/purity workaround already established elsewhere
// in this repo for a bare `new Date()`/`Date.now()` call in a component
// body (see app/(dashboard)/page.tsx's currentTimeMs() comment) — wrapping
// it in its own named function avoids the lint rule. Local (not UTC) time
// on purpose: unlike the UTC-anchored day arithmetic in lib/format.ts
// (deliberately avoiding Date-parsing DST bugs for pure string math), this
// runs only in the browser to highlight "today" for the person actually
// looking at the calendar — their local calendar day is the correct one to
// highlight, not a UTC-shifted one.
function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function utcDateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Monday-first 6x7 grid (42 cells) around the given month, including the
// trailing days of the previous month and leading days of the next one so
// the grid is always a full rectangle — same "always render the full
// shape, don't leave gaps" spirit as HistoryChart's zero-activity slivers.
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  const firstWeekday = (first.getUTCDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return d;
  });
}

// Locale-aware weekday short labels via Intl (native app parity isn't a
// concern here, this is web-only UI chrome) — no hardcoded month/weekday
// name arrays to keep in sync with the `lang`/`locale` switch, unlike
// lib/format.ts's MONTH_LABELS_DE (which stays German-only on purpose,
// it only feeds the German-only CSV/PDF export content). 2024-01-01 is a
// known Monday, used purely as an arbitrary anchor to walk one full week.
function weekdayLabels(locale: string): string[] {
  const monday = new Date(Date.UTC(2024, 0, 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toLocaleDateString(locale, { weekday: "short" });
  });
}

export function HistoryDateRangePicker({
  from,
  to,
  projectId,
  lang,
  locale,
  basePath = "/dashboard/history",
}: HistoryDateRangePickerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => isoToUtcDate(to).getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(() => isoToUtcDate(to).getUTCMonth());
  // Holds the first-clicked day while a range selection is in progress —
  // null means "no selection started yet, next click begins one".
  const [anchor, setAnchor] = useState<string | null>(null);
  const [pendingFrom, setPendingFrom] = useState(from);
  const [pendingTo, setPendingTo] = useState(to);

  // Close on an outside click — standard popover behavior, matches the
  // toast dismiss/settings dropdown patterns already used elsewhere in
  // this repo's Client Components.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openPicker() {
    setPendingFrom(from);
    setPendingTo(to);
    setAnchor(null);
    const toDate = isoToUtcDate(to);
    setViewYear(toDate.getUTCFullYear());
    setViewMonth(toDate.getUTCMonth());
    setOpen(true);
  }

  function navigateTo(nextFrom: string, nextTo: string) {
    const query = new URLSearchParams({ from: nextFrom, to: nextTo });
    if (projectId) query.set("project", projectId);
    setOpen(false);
    router.push(`${basePath}?${query.toString()}`);
  }

  function handleDayClick(iso: string) {
    if (anchor === null) {
      setAnchor(iso);
      setPendingFrom(iso);
      setPendingTo(iso);
      return;
    }
    const [nextFrom, nextTo] = iso < anchor ? [iso, anchor] : [anchor, iso];
    setAnchor(null);
    setPendingFrom(nextFrom);
    setPendingTo(nextTo);
    // Auto-apply on the second click — one fewer click for the common
    // case, consistent with this app's general "flat, few-step" UI
    // preference. The explicit "Anwenden" button below still covers a
    // deliberate single-day range (one click only) or re-confirming the
    // range unchanged.
    navigateTo(nextFrom, nextTo);
  }

  function changeMonth(delta: number) {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  }

  const grid = buildMonthGrid(viewYear, viewMonth);
  const weekdays = weekdayLabels(locale);
  const monthLabel = new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const today = todayIso();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-expanded={open}
        className="rounded-md border border-line px-3 py-1 text-sm text-foreground/70 transition-colors duration-150 hover:text-foreground"
      >
        {t(lang, history.chooseRange)}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t(lang, history.calendarLabel)}
          // Ticket 048: bg-background -> bg-surface (this is a floating
          // card, same token every other card in the app now uses).
          // shadow-lg -> a softer, warmer-tinted custom shadow — floating
          // overlays are the one place this ticket's "kaum Schatten" rule
          // doesn't mean NO shadow (an overlay needs some visual lift off
          // the page to read as "floating," unlike a flat in-page card),
          // but shadow-lg's default cool-black shadow was heavier than the
          // ticket's "keine übertriebenen 3D-Effekte" spirit wants. Same
          // value reused verbatim in DashboardNav.tsx's UserMenu dropdown
          // and ToastProvider.tsx's toast for one consistent "floating
          // surface" shadow across the app instead of three slightly
          // different ad hoc ones.
          // animate-dropdown-in (globals.css, Ticket 048): the ticket's
          // explicit "Dropdown Fade + translateY(4px)" requirement — this
          // popover previously appeared with a hard cut.
          className="absolute z-10 mt-2 w-72 animate-dropdown-in rounded-xl border border-line bg-surface p-3 shadow-[0_4px_16px_-4px_rgba(24,24,23,0.12)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label={t(lang, history.previousMonth)}
              className="rounded-md px-2 py-1 text-sm transition-colors duration-150 hover:bg-paper"
            >
              ‹
            </button>
            <span className="text-sm font-medium capitalize">{monthLabel}</span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label={t(lang, history.nextMonth)}
              className="rounded-md px-2 py-1 text-sm transition-colors duration-150 hover:bg-paper"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-foreground/50">
            {weekdays.map((weekday, i) => (
              // Index-based key: weekdayLabels() always returns the same
              // fixed 7-entry Mon-Sun sequence for a given locale, so
              // position is a stable identity here.
              <span key={i}>{weekday}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((date) => {
              const iso = utcDateToIso(date);
              const inMonth = date.getUTCMonth() === viewMonth;
              const inRange = iso >= pendingFrom && iso <= pendingTo;
              const isRangeEdge = iso === pendingFrom || iso === pendingTo;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleDayClick(iso)}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isRangeEdge}
                  className={[
                    "rounded-md py-1 text-xs tabular-nums transition-colors duration-150",
                    inMonth ? "text-foreground" : "text-foreground/30",
                    isRangeEdge
                      ? "bg-brand text-background"
                      : inRange
                        ? "bg-brand-soft"
                        : "hover:bg-paper",
                    isToday && !isRangeEdge ? "ring-1 ring-inset ring-brand" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {date.getUTCDate()}
                </button>
              );
            })}
          </div>

          <p className="mt-3 font-mono text-[11px] tabular-nums text-foreground/60">
            {t(lang, history.from)} {pendingFrom} · {t(lang, history.to)} {pendingTo}
          </p>

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={secondaryButtonSmallClass}>
              {t(lang, common.cancel)}
            </button>
            <button
              type="button"
              onClick={() => navigateTo(pendingFrom, pendingTo)}
              className={primaryButtonSmallClass}
            >
              {t(lang, history.apply)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
