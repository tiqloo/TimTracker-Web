import type { DailyBreakdown, TimeEntry } from "./time-entry";
import type { Project } from "./project";
import {
  PAUSE_PROJECT_ID,
  STANDARD_PROJECT_ID,
  unionSeconds,
} from "./time-entry-aggregation.ts";

export interface HistorySummary {
  totalSeconds: number;
  averageSecondsPerActiveDay: number;
  projectCount: number;
}

export interface ProjectTimeTotal {
  id: string;
  name: string;
  colorHex: string;
  seconds: number;
  percentage: number;
}

export function buildHistorySummary(
  breakdowns: DailyBreakdown[],
  projectTotals: ProjectTimeTotal[],
): HistorySummary {
  const totalSeconds = breakdowns.reduce((sum, day) => sum + day.totalSeconds, 0);
  const activeDays = breakdowns.filter((day) => day.totalSeconds > 0).length;
  return {
    totalSeconds,
    averageSecondsPerActiveDay: activeDays > 0 ? totalSeconds / activeDays : 0,
    projectCount: projectTotals.length,
  };
}

export function buildProjectTimeTotals(
  entries: TimeEntry[],
  projects: Project[],
  now: Date,
): ProjectTimeTotal[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const entriesByProject = new Map<string, TimeEntry[]>();

  for (const entry of entries) {
    if (entry.projectId === STANDARD_PROJECT_ID || entry.projectId === PAUSE_PROJECT_ID) continue;
    if (!projectById.has(entry.projectId)) continue;
    const bucket = entriesByProject.get(entry.projectId) ?? [];
    bucket.push(entry);
    entriesByProject.set(entry.projectId, bucket);
  }

  // Ticket 086: same union-not-sum fix as `buildDailyBreakdowns`, applied
  // per individual project here (this function's own grouping) instead of
  // per the three day-breakdown categories — two overlapping entries for
  // the SAME project must count their overlap once.
  const secondsByProject = new Map<string, number>(
    Array.from(entriesByProject.entries()).map(([projectId, projectEntries]) => [
      projectId,
      unionSeconds(projectEntries, now),
    ]),
  );

  const totalProjectSeconds = Array.from(secondsByProject.values()).reduce(
    (sum, seconds) => sum + seconds,
    0,
  );

  return Array.from(secondsByProject.entries())
    .map(([id, seconds]) => {
      const project = projectById.get(id)!;
      return {
        id,
        name: project.name,
        colorHex: project.colorHex,
        seconds,
        percentage: totalProjectSeconds > 0 ? seconds / totalProjectSeconds : 0,
      };
    })
    .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));
}

