"use client";

// All interactive "Projekte" CRUD lives here (create, inline rename,
// archive/unarchive, duplicate-name warning) — a Client Component because
// every action needs immediate feedback without a full page reload, same
// reasoning as the (auth)/* pages. Gets its Repositories instance from
// lib/application/client.ts (the one designated exception, see CLAUDE.md's
// "Resolved 2026-08-25" entry) and calls straight into
// lib/application/projects.ts — never lib/repositories/* directly.
//
// Archiving is NOT deletion (docs/tickets/001-project-tracking.md's edge
// cases: an archived project's historical time entries must remain intact
// and correctly attributed) — archived projects stay visible here, just
// grouped separately and visually muted, never hidden or removed from the
// list.
import { useState } from "react";
import {
  archiveProject,
  createProject,
  renameProject,
} from "@/lib/application/projects";
import { getRepositories } from "@/lib/application/client";
import {
  PROJECT_COLOR_PALETTE,
  projectNameExists,
  suggestedProjectColor,
  type Project,
} from "@/lib/domain/project";
import { common, projects as i18nProjects, t, type Lang } from "@/lib/i18n";

const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

const buttonClass =
  "rounded-md border border-line px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50";

const errorClass =
  "rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400";

const warningClass = "text-sm text-amber-700 dark:text-amber-400";

function ColorSwatch({ colorHex }: { colorHex: string }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-line"
      style={{ backgroundColor: `#${colorHex}` }}
      aria-hidden
    />
  );
}

function ColorPicker({
  value,
  onChange,
  disabled,
  lang,
}: {
  value: string;
  onChange: (colorHex: string) => void;
  disabled?: boolean;
  lang: Lang;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t(lang, common.color)}>
      {PROJECT_COLOR_PALETTE.map((colorHex) => (
        <button
          key={colorHex}
          type="button"
          role="radio"
          aria-checked={value === colorHex}
          disabled={disabled}
          onClick={() => onChange(colorHex)}
          className={`h-6 w-6 rounded-full border-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            value === colorHex
              ? "border-foreground"
              : "border-transparent"
          }`}
          style={{ backgroundColor: `#${colorHex}` }}
          title={`#${colorHex}`}
        />
      ))}
    </div>
  );
}

export function ProjectsClient({
  initialProjects,
  lang,
}: {
  initialProjects: Project[];
  lang: Lang;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const active = projects.filter((project) => !project.isArchived);
  const archived = projects.filter((project) => project.isArchived);

  return (
    <div className="flex flex-col gap-10">
      <CreateProjectForm
        projects={projects}
        onCreated={(project) => setProjects((prev) => [project, ...prev])}
        lang={lang}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground/70">
          {t(lang, i18nProjects.activeProjects)}
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-foreground/60">{t(lang, i18nProjects.noProjectsYet)}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-t border-line">
            {active.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                allProjects={projects}
                onChanged={(updated) =>
                  setProjects((prev) =>
                    prev.map((p) => (p.id === updated.id ? updated : p)),
                  )
                }
                lang={lang}
              />
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground/70">
            {t(lang, i18nProjects.archivedProjects)}
          </h2>
          <ul className="flex flex-col divide-y divide-line border-t border-line opacity-60">
            {archived.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                allProjects={projects}
                onChanged={(updated) =>
                  setProjects((prev) =>
                    prev.map((p) => (p.id === updated.id ? updated : p)),
                  )
                }
                lang={lang}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CreateProjectForm({
  projects,
  onCreated,
  lang,
}: {
  projects: Project[];
  onCreated: (project: Project) => void;
  lang: Lang;
}) {
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [colorHex, setColorHex] = useState(
    suggestedProjectColor(projects.length),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const trimmedName = name.trim();
  // Non-blocking duplicate-name warning, mirrors
  // NewProjectFormView/DashboardViewModel.newProjectHasDuplicateWarning in
  // the native app — duplicates are explicitly ALLOWED (e.g. the same
  // project name for two different customers), so this never disables the
  // submit button, it's purely informational.
  const duplicateWarning =
    trimmedName.length > 0 && projectNameExists(trimmedName, projects);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!trimmedName) {
      setError(t(lang, i18nProjects.nameRequiredError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      const project = await createProject(repos, {
        name: trimmedName,
        colorHex,
        customer: customer.trim(),
        notes: notes.trim(),
      });
      onCreated(project);
      setName("");
      setCustomer("");
      setNotes("");
      setColorHex(suggestedProjectColor(projects.length + 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, i18nProjects.createError));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-line p-5"
    >
      <h2 className="text-sm font-medium text-foreground/70">{t(lang, i18nProjects.newProject)}</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-project-name" className="text-sm font-medium">
          {t(lang, common.name)}
        </label>
        <input
          id="new-project-name"
          type="text"
          required
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        {duplicateWarning && (
          <p className={warningClass}>{t(lang, i18nProjects.createDuplicateWarning)}</p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-project-customer" className="text-sm font-medium">
          {t(lang, i18nProjects.customerOptional)}
        </label>
        <input
          id="new-project-customer"
          type="text"
          disabled={pending}
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-project-notes" className="text-sm font-medium">
          {t(lang, i18nProjects.noteOptional)}
        </label>
        <textarea
          id="new-project-notes"
          rows={2}
          disabled={pending}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t(lang, common.color)}</span>
        <ColorPicker value={colorHex} onChange={setColorHex} disabled={pending} lang={lang} />
      </div>
      {error && <p className={errorClass}>{error}</p>}
      <div>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? t(lang, i18nProjects.creating) : t(lang, i18nProjects.createProject)}
        </button>
      </div>
    </form>
  );
}

function ProjectRow({
  project,
  allProjects,
  onChanged,
  lang,
}: {
  project: Project;
  allProjects: Project[];
  onChanged: (project: Project) => void;
  lang: Lang;
}) {
  const [editing, setEditing] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  async function handleArchiveToggle() {
    setArchiveError(null);
    setArchivePending(true);
    try {
      const repos = getRepositories();
      const nextArchived = !project.isArchived;
      await archiveProject(repos, project.id, nextArchived);
      onChanged({ ...project, isArchived: nextArchived });
    } catch (err) {
      setArchiveError(
        err instanceof Error ? err.message : t(lang, i18nProjects.archiveToggleError),
      );
    } finally {
      setArchivePending(false);
    }
  }

  if (editing) {
    return (
      <li className="py-3">
        <EditProjectForm
          project={project}
          allProjects={allProjects}
          onSaved={(updated) => {
            onChanged(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          lang={lang}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <ColorSwatch colorHex={project.colorHex} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {project.name}
              {project.isArchived && (
                <span className="ml-2 rounded bg-paper px-1.5 py-0.5 text-xs font-normal text-foreground/60">
                  {t(lang, i18nProjects.archived)}
                </span>
              )}
            </p>
            {project.customer && (
              <p className="truncate text-xs text-foreground/60">{project.customer}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditing(true)} className={buttonClass}>
            {t(lang, i18nProjects.edit)}
          </button>
          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={archivePending}
            className={buttonClass}
          >
            {archivePending
              ? "…"
              : project.isArchived
                ? t(lang, i18nProjects.reactivate)
                : t(lang, i18nProjects.archive)}
          </button>
        </div>
      </div>
      {project.notes && (
        <p className="truncate text-xs text-foreground/60">{project.notes}</p>
      )}
      {archiveError && <p className={errorClass}>{archiveError}</p>}
    </li>
  );
}

// Matches the native "Edit Project" dialog's scope exactly: name + notes
// only, no time fields, no color/customer change (docs/tickets/
// 005-edit-project.md in TimTracker-Starter) — renameProject()'s signature
// already reflects this same scope.
function EditProjectForm({
  project,
  allProjects,
  onSaved,
  onCancel,
  lang,
}: {
  project: Project;
  allProjects: Project[];
  onSaved: (project: Project) => void;
  onCancel: () => void;
  lang: Lang;
}) {
  const [name, setName] = useState(project.name);
  const [notes, setNotes] = useState(project.notes);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const trimmedName = name.trim();
  const duplicateWarning =
    trimmedName.length > 0 &&
    projectNameExists(trimmedName, allProjects, project.id);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!trimmedName) {
      setError(t(lang, i18nProjects.nameRequiredError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      const updated = await renameProject(repos, project.id, trimmedName, notes.trim());
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, i18nProjects.saveError));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-name-${project.id}`} className="text-sm font-medium">
          {t(lang, common.name)}
        </label>
        <input
          id={`edit-name-${project.id}`}
          type="text"
          required
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        {duplicateWarning && (
          <p className={warningClass}>{t(lang, i18nProjects.editDuplicateWarning)}</p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-notes-${project.id}`} className="text-sm font-medium">
          {t(lang, common.note)}
        </label>
        <textarea
          id={`edit-notes-${project.id}`}
          rows={2}
          disabled={pending}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && <p className={errorClass}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? t(lang, common.saving) : t(lang, common.save)}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={buttonClass}
        >
          {t(lang, common.cancel)}
        </button>
      </div>
    </form>
  );
}
