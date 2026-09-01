"use client";

// Ticket 034 ("Nicht zugeordnete Zeit" direkt einem Projekt zuordnen
// können) — the one new interactive control this ticket adds: a small,
// self-contained inline "Jetzt zuordnen" action rendered by DayDetail.tsx
// next to every unassigned (kind "auto") entry row.
//
// Per-entry, not per-day (deliberate — see the ticket's own edge case:
// "mehrere nicht zusammenhängende Segmente am selben Tag -> jedes Segment
// einzeln zuordenbar, keine erzwungene Alles-oder-nichts-Zuordnung"). One
// <AssignTimeAction> instance = one time_entries row = one independent
// assign action, so opening/assigning one unassigned segment never
// affects any other segment's own pending state.
//
// The project list itself is fetched once by the DayDetail parent (not
// here) and handed down as a prop — sharing one fetch across every
// unassigned row on the same day rather than each row independently
// re-fetching the same list, see DayDetail.tsx's own comment for why.
//
// Two-step reveal (button -> inline form) mirrors this repo's existing
// convention for exactly this kind of small, contained action (see
// ProjectsClient.tsx's CreateProjectSection/EditProjectForm) rather than
// introducing a modal/popover component that exists nowhere else here.
import { useState } from "react";
import Link from "next/link";
import { assignTimeEntryToProject } from "@/lib/application/dashboard";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import type { Project } from "@/lib/domain/project";
import type { TimeEntry } from "@/lib/domain/time-entry";
import { common, dayDetail, projects as projectsI18n, t, type Lang } from "@/lib/i18n";

const selectClass =
  "rounded-md border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

// --brand (Ticket 037) — this product's one accent color, reused here as
// the confirm action's primary button exactly like ProjectsClient.tsx's
// primaryButtonClass, not a new color.
const confirmButtonClass =
  "rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-50";

const linkButtonClass =
  "text-xs font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50";

const cancelButtonClass =
  "rounded-md border border-line px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50";

export function AssignTimeAction({
  entry,
  projects,
  projectsError,
  lang,
  onAssigned,
}: {
  entry: TimeEntry;
  // `null` = still loading (parent's fetch hasn't resolved yet).
  projects: Project[] | null;
  projectsError: boolean;
  lang: Lang;
  onAssigned: (updated: TimeEntry) => void;
}) {
  const { showSuccess, showError } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={linkButtonClass}>
        {t(lang, dayDetail.assignAction)}
      </button>
    );
  }

  const activeProjects = (projects ?? []).filter((project) => !project.isArchived);
  const archivedProjects = (projects ?? []).filter((project) => project.isArchived);

  function handleCancel() {
    setOpen(false);
    setSelectedProjectId("");
    setFieldError(null);
  }

  async function handleConfirm() {
    setFieldError(null);
    const trimmed = selectedProjectId.trim();
    if (!trimmed) {
      setFieldError(t(lang, dayDetail.assignSelectRequiredError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      const updated = await assignTimeEntryToProject(repos, entry.id, trimmed);
      onAssigned(updated);
      showSuccess(t(lang, dayDetail.assignSuccess));
      setOpen(false);
      setSelectedProjectId("");
    } catch {
      // Edge case (ticket AK): on failure, the caller's local
      // entries/breakdown state is left untouched (onAssigned is only
      // called on success above) — a clear error toast, no silent
      // partial success. The inline form itself also stays open with the
      // user's selection intact, so they don't have to re-pick the
      // project after a transient network error.
      showError(t(lang, dayDetail.assignError));
    } finally {
      setPending(false);
    }
  }

  if (projectsError) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-red-700 dark:text-red-400">
          {t(lang, dayDetail.assignProjectsLoadError)}
        </span>
        <button type="button" onClick={handleCancel} className={cancelButtonClass}>
          {t(lang, common.cancel)}
        </button>
      </div>
    );
  }

  if (projects !== null && projects.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-foreground/60">{t(lang, dayDetail.assignNoProjectsYet)}</span>
        <Link href="/dashboard/projects" className="font-medium text-brand hover:underline">
          {t(lang, dayDetail.assignNoProjectsCta)}
        </Link>
        <button type="button" onClick={handleCancel} className={cancelButtonClass}>
          {t(lang, common.cancel)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`assign-project-${entry.id}`}>
        {t(lang, dayDetail.assignSelectLabel)}
      </label>
      <select
        id={`assign-project-${entry.id}`}
        value={selectedProjectId}
        onChange={(e) => {
          setSelectedProjectId(e.target.value);
          setFieldError(null);
        }}
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
      <button
        type="button"
        onClick={handleConfirm}
        disabled={pending || projects === null}
        className={confirmButtonClass}
      >
        {pending ? t(lang, common.saving) : t(lang, dayDetail.assignConfirm)}
      </button>
      <button type="button" onClick={handleCancel} disabled={pending} className={cancelButtonClass}>
        {t(lang, common.cancel)}
      </button>
      {fieldError && (
        <p className="w-full text-xs text-red-700 dark:text-red-400">{fieldError}</p>
      )}
    </div>
  );
}
