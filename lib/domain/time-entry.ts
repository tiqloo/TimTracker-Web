// Domain model — mirrors Domain/Models/TimeEntry.swift in TimTracker-Starter.
export type TimeEntrySource = "auto" | "manual" | "pause";

export interface TimeEntry {
  id: string;
  projectId: string;
  day: string; // ISO date (yyyy-MM-dd)
  startTime: string; // ISO datetime
  endTime: string | null; // null = still running
  source: TimeEntrySource;
  note: string | null;
  updatedAt: string;
}

// Mirrors Application/Interfaces/DailyBreakdown.swift, including the
// unassignedSeconds fix from Ticket 001 — same formula, same field names,
// so the web and native apps never disagree on what a day's numbers mean.
export interface DailyBreakdown {
  day: string;
  standardSeconds: number;
  projectSeconds: number;
  pauseSeconds: number;
  totalSeconds: number;
  unassignedSeconds: number;
}
