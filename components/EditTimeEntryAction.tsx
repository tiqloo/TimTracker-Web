"use client";

// Ticket 195 ("Zeiteinträge manuell bearbeiten, löschen und nachtragen
// können") — full edit of an EXISTING entry's start time, end time,
// project and note. Unlike AssignTimeAction.tsx (Ticket 034, limited to
// reassigning an unassigned automatic segment), this renders on EVERY
// entry row in DayDetail.tsx — a wrongly-tracked automatic session, an
// already-assigned project entry, a pause segment, or a previously
// manually-added one are all equally editable.
//
// Same two-step reveal / per-row-instance / shared-project-list-from-
// parent shape as AssignTimeAction.tsx — see that file's own header
// comment for the full reasoning, not repeated here.
import { useState } from "react";
import Link from "next/link";
import { updateTimeEntry } from "@/lib/application/dashboard";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import type { Project } from "@/lib/domain/project";
import type { TimeEntry } from "@/lib/domain/time-entry";
import { toTimeInputValue } from "@/lib/format";
import { common, dayDetail, projects as projectsI18n, t, type Lang } from "@/lib/i18n";
import {
  primaryButtonSmallClass,
  secondaryButtonSmallClass,
  tertiaryButtonClass,
} from "@/lib/ui/button-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

const selectClass =
  "rounded-md border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";
const inputClass = selectClass;
const linkButtonClass = `${tertiaryButtonClass} text-xs`;

export function EditTimeEntryAction({
  entry,
  day,
  projects,
  projectsError,
  lang,
  onUpdated,
}: {
  entry: TimeEntry;
  // The day-detail page this row is rendered on — an edit never moves an
  // entry to a different calendar day (Ticket 195's own "Scoping-
  // Entscheidung"), only the time-of-day within it, so the HH:mm inputs
  // below always combine with THIS fixed day.
  day: string;
  projects: Project[] | null;
  projectsError: boolean;
  lang: Lang;
  onUpdated: (updated: TimeEntry) => void;
}) {
  const { showSuccess, showError } = useToast();
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState(() => toTimeInputValue(entry.startTime));
  const [endTime, setEndTime] = useState(() =>
    entry.endTime ? toTimeInputValue(entry.endTime) : toTimeInputValue(new Date().toISOString()),
  );
  const [projectId, setProjectId] = useState(entry.projectId);
  const [note, setNote] = useState(entry.note ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={linkButtonClass}>
        {t(lang, dayDetail.editAction)}
      </button>
    );
  }

  const activeProjects = (projects ?? []).filter((project) => !project.isArchived);
  const archivedProjects = (projects ?? []).filter((project) => project.isArchived);

  function handleCancel() {
    setOpen(false);
    setFieldError(null);
    // Reset to the entry's own current values, not whatever was left
    // half-typed — reopening always starts from a clean, accurate state.
    setStartTime(toTimeInputValue(entry.startTime));
    setEndTime(entry.endTime ? toTimeInputValue(entry.endTime) : toTimeInputValue(new Date().toISOString()));
    setProjectId(entry.projectId);
    setNote(entry.note ?? "");
  }

  async function handleConfirm() {
    setFieldError(null);
    if (!projectId) {
      setFieldError(t(lang, dayDetail.assignSelectRequiredError));
      return;
    }
    // Client-side pre-check for immediate feedback — updateTimeEntry()
    // enforces the exact same rule server-side (and the DB's own
    // `time_entries_end_after_start_check` CHECK constraint is the actual
    // last word either way), this just avoids a round-trip for the most
    // common typo.
    if (endTime <= startTime) {
      setFieldError(t(lang, dayDetail.editEndBeforeStartError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      const updated = await updateTimeEntry(repos, entry.id, day, {
        projectId,
        startTime,
        endTime,
        note: note.trim() || null,
      });
      onUpdated(updated);
      showSuccess(t(lang, dayDetail.editSuccess));
      setOpen(false);
    } catch {
      // Same edge-case handling as AssignTimeAction: on failure the
      // caller's local state is untouched (onUpdated only runs on
      // success), the form stays open with the user's edits intact.
      showError(t(lang, dayDetail.editError));
    } finally {
      setPending(false);
    }
  }

  if (projectsError) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span {...errorFeedbackProps} className="text-red-700 dark:text-red-400">
          {t(lang, dayDetail.assignProjectsLoadError)}
        </span>
        <button type="button" onClick={handleCancel} className={secondaryButtonSmallClass}>
          {t(lang, common.cancel)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-paper/60 p-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-xs text-text-secondary">
          {t(lang, dayDetail.editStartLabel)}
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-text-secondary">
          {t(lang, dayDetail.editEndLabel)}
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs text-text-secondary">
          {t(lang, dayDetail.editProjectLabel)}
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={pending || projects === null}
            className={selectClass}
          >
            {projects === null && <option value={projectId}>{t(lang, dayDetail.assignProjectsLoading)}</option>}
            {activeProjects.length > 0 && (
              <optgroup label={t(lang, projectsI18n.activeProjects)}>
                {activeProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </optgroup>
            )}
            {archivedProjects.length > 0 && (
              <optgroup label={t(lang, projectsI18n.archivedProjects)}>
                {archivedProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {`${project.name} (${t(lang, projectsI18n.archived)})`}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-0.5 text-xs text-text-secondary">
        {t(lang, dayDetail.editNoteLabel)}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleConfirm} disabled={pending} className={primaryButtonSmallClass}>
          {pending ? t(lang, common.saving) : t(lang, dayDetail.editSave)}
        </button>
        <button type="button" onClick={handleCancel} disabled={pending} className={secondaryButtonSmallClass}>
          {t(lang, common.cancel)}
        </button>
        {projects !== null && projects.length === 0 && (
          <Link
            href="/dashboard/projects"
            className="text-xs font-medium text-brand transition-colors duration-150 hover:underline"
          >
            {t(lang, dayDetail.assignNoProjectsCta)}
          </Link>
        )}
      </div>
      {fieldError && (
        <p {...errorFeedbackProps} className="text-xs text-red-700 dark:text-red-400">{fieldError}</p>
      )}
    </div>
  );
}
