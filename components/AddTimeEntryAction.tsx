"use client";

// Ticket 195 — "+ Zeit nachtragen": creates a brand-new, manually
// backfilled entry (source "manual") for the day this component is
// rendered on. Always visible (bottom of the entries list AND the empty
// state, see DayDetail.tsx) — unlike Edit/Delete, this isn't attached to
// an existing row, so it's a single standalone action rather than
// per-entry.
import { useState } from "react";
import Link from "next/link";
import { createTimeEntry } from "@/lib/application/dashboard";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import type { Project } from "@/lib/domain/project";
import type { TimeEntry } from "@/lib/domain/time-entry";
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

export function AddTimeEntryAction({
  day,
  projects,
  projectsError,
  lang,
  onCreated,
}: {
  day: string;
  projects: Project[] | null;
  projectsError: boolean;
  lang: Lang;
  onCreated: (created: TimeEntry) => void;
}) {
  const { showSuccess, showError } = useToast();
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={linkButtonClass}>
        + {t(lang, dayDetail.addAction)}
      </button>
    );
  }

  const activeProjects = (projects ?? []).filter((project) => !project.isArchived);
  const archivedProjects = (projects ?? []).filter((project) => project.isArchived);

  function handleCancel() {
    setOpen(false);
    setFieldError(null);
    setStartTime("09:00");
    setEndTime("10:00");
    setProjectId("");
    setNote("");
  }

  async function handleConfirm() {
    setFieldError(null);
    if (!projectId) {
      setFieldError(t(lang, dayDetail.assignSelectRequiredError));
      return;
    }
    if (endTime <= startTime) {
      setFieldError(t(lang, dayDetail.editEndBeforeStartError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      const created = await createTimeEntry(repos, day, {
        projectId,
        startTime,
        endTime,
        note: note.trim() || null,
      });
      onCreated(created);
      showSuccess(t(lang, dayDetail.addSuccess));
      handleCancel();
    } catch {
      showError(t(lang, dayDetail.addError));
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

  if (projects !== null && projects.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-foreground/60">{t(lang, dayDetail.assignNoProjectsYet)}</span>
        <Link
          href="/dashboard/projects"
          className="font-medium text-brand transition-colors duration-150 hover:underline"
        >
          {t(lang, dayDetail.assignNoProjectsCta)}
        </Link>
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
            autoFocus
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={pending || projects === null}
            className={selectClass}
          >
            <option value="">
              {projects === null
                ? t(lang, dayDetail.assignProjectsLoading)
                : t(lang, dayDetail.assignSelectPlaceholder)}
            </option>
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
        <button type="button" onClick={handleConfirm} disabled={pending || projects === null} className={primaryButtonSmallClass}>
          {pending ? t(lang, common.saving) : t(lang, dayDetail.editSave)}
        </button>
        <button type="button" onClick={handleCancel} disabled={pending} className={secondaryButtonSmallClass}>
          {t(lang, common.cancel)}
        </button>
      </div>
      {fieldError && (
        <p {...errorFeedbackProps} className="text-xs text-red-700 dark:text-red-400">{fieldError}</p>
      )}
    </div>
  );
}
