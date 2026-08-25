// Pure formatting helpers — no side effects, no data access, so this
// lives outside lib/application/* (which is reserved for use cases that
// take a Repositories argument) and outside lib/domain/* (which holds
// models + business rules, not display formatting). Safe to import from
// both Server and Client Components.

// Mirrors TimeFormatter.shortDurationString(from:) in
// Shared/Helpers/TimeFormatter.swift (TimTracker-Starter) — same
// "Xh Ym" / "Ym" shape, so the web and native apps show duration
// identically for the same underlying seconds value.
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// "14:32" in the viewer's local time zone — used for time-entry start/end
// times in the flat "Heute" list.
export function formatTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
