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
import { useToast } from "@/components/ToastProvider";
import {
  PROJECT_COLOR_PALETTE,
  projectNameExists,
  suggestedProjectColor,
  type Project,
} from "@/lib/domain/project";
import { common, projects as i18nProjects, t, type Lang } from "@/lib/i18n";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/ui/button-styles";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps, warningFeedbackProps } from "@/lib/ui/feedback";

const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

// Ticket 048: Secondary tier (lib/ui/button-styles.ts) — was a locally
// defined "buttonClass" (border-line, no fill) before this ticket's button
// consolidation pass; primaryButtonClass below is now imported rather than
// locally defined for the same reason.
const buttonClass = secondaryButtonClass;

// Ticket 039: smaller/more subtle variant of buttonClass for ProjectRow's
// per-row Edit/Archive actions — transparent border by default, the
// visible border/background only appears on the button's own hover, on
// top of the row-level opacity reveal (see ProjectRow's `group`/
// `focus-within` comment) that dims the whole pair until the row is
// hovered/focused.
const rowActionButtonClass =
  "rounded-md border border-transparent px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:border-line hover:bg-paper hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

// Ticket 048: lib/ui/status-styles.ts (--danger token) — was locally
// defined before this ticket's status-token consolidation pass.
const errorClass = errorMessageClass;

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
  name,
  value,
  onChange,
  disabled,
  lang,
}: {
  name: string;
  value: string;
  onChange: (colorHex: string) => void;
  disabled?: boolean;
  lang: Lang;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t(lang, common.color)}>
      {PROJECT_COLOR_PALETTE.map((colorHex) => (
        <label
          key={colorHex}
          className={`relative h-6 w-6 rounded-full border-2 ${
            value === colorHex
              ? "border-foreground"
              : "border-transparent"
          } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          style={{ backgroundColor: `#${colorHex}` }}
          title={`#${colorHex}`}
        >
          <input
            type="radio"
            name={name}
            value={colorHex}
            checked={value === colorHex}
            disabled={disabled}
            onChange={() => onChange(colorHex)}
            aria-label={`#${colorHex}`}
            className="peer sr-only"
          />
          <span className="pointer-events-none absolute inset-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-brand/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" />
        </label>
      ))}
    </div>
  );
}

type SortOption = "recent" | "name";

export function ProjectsClient({
  initialProjects,
  lang,
}: {
  initialProjects: Project[];
  lang: Lang;
}) {
  const [projects, setProjects] = useState(initialProjects);
  // Search/sort (Ticket 039) apply only to the active list, never to
  // archived — the ticket's own AK explicitly says not to mix the two.
  // Both are purely client-side derived state (no extra request, no new
  // state to keep in sync): `initialProjects` already holds every project
  // up front, so filtering/sorting on every render is enough at the scale
  // this ticket targets (see its own "bewusst außerhalb"/out-of-scope note
  // on server-side search/pagination).
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  const archived = projects.filter((project) => project.isArchived);
  const activeAll = projects.filter((project) => !project.isArchived);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredActive = normalizedSearch
    ? activeAll.filter(
        (project) =>
          project.name.toLowerCase().includes(normalizedSearch) ||
          project.customer.toLowerCase().includes(normalizedSearch),
      )
    : activeAll;

  const active = [...filteredActive].sort((a, b) =>
    sortBy === "name"
      ? a.name.localeCompare(b.name, lang)
      : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  function handleChanged(updated: Project) {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div className="flex flex-col gap-10">
      <CreateProjectSection
        projects={projects}
        onCreated={(project) => setProjects((prev) => [project, ...prev])}
        lang={lang}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground/70">
          {t(lang, i18nProjects.activeProjects)}
        </h2>
        {activeAll.length === 0 ? (
          <p className="text-sm text-foreground/60">{t(lang, i18nProjects.noProjectsYet)}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-1 min-w-[12rem] flex-col gap-1">
                <span className="text-xs font-medium text-foreground/60">
                  {t(lang, i18nProjects.searchLabel)}
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t(lang, i18nProjects.searchPlaceholder)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground/60">
                  {t(lang, i18nProjects.sortLabel)}
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className={inputClass}
                >
                  <option value="recent">{t(lang, i18nProjects.sortByRecentOption)}</option>
                  <option value="name">{t(lang, i18nProjects.sortByNameOption)}</option>
                </select>
              </label>
            </div>
            {active.length === 0 ? (
              <p className="text-sm text-foreground/60">{t(lang, i18nProjects.noSearchResults)}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line border-t border-line">
                {active.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    allProjects={projects}
                    onChanged={handleChanged}
                    lang={lang}
                  />
                ))}
              </ul>
            )}
          </>
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
                onChanged={handleChanged}
                lang={lang}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Ticket 039: "Neues Projekt" collapses behind a button, the form itself
// only appears after a click — same two-step-reveal convention already
// used by SettingsClient.tsx's EmailChangeAction/DeleteAccountSection (a
// button first, the form only after it's clicked), reused here rather than
// inventing a modal/sidepanel that appears nowhere else in this repo.
// `creating` is local to this wrapper and starts false on every mount, so
// conditionally mounting CreateProjectForm only while true also means its
// own field state (name/customer/notes/colorHex/error) is thrown away for
// free every time the panel closes — no manual reset needed on cancel.
function CreateProjectSection({
  projects,
  onCreated,
  lang,
}: {
  projects: Project[];
  onCreated: (project: Project) => void;
  lang: Lang;
}) {
  const [creating, setCreating] = useState(false);

  if (!creating) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={primaryButtonClass}
        >
          {t(lang, i18nProjects.newProject)}
        </button>
      </div>
    );
  }

  return (
    <CreateProjectForm
      projects={projects}
      onCreated={(project) => {
        onCreated(project);
        setCreating(false);
      }}
      onCancel={() => setCreating(false)}
      lang={lang}
    />
  );
}

function CreateProjectForm({
  projects,
  onCreated,
  onCancel,
  lang,
}: {
  projects: Project[];
  onCreated: (project: Project) => void;
  onCancel: () => void;
  lang: Lang;
}) {
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [colorHex, setColorHex] = useState(
    suggestedProjectColor(projects.length),
  );
  // Only ever holds the synchronous, blocking "name required" validation
  // error (Ticket 042 AK: blocking form validation errors stay inline,
  // right at the field). A createProject() request failure below now goes
  // through showError() (a toast) instead of this state.
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
      showSuccess(t(lang, i18nProjects.createSuccess));
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nProjects.createError));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <h2 className="text-sm font-medium text-foreground/70">{t(lang, i18nProjects.newProject)}</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-project-name" className="text-sm font-medium">
          {t(lang, common.name)}
        </label>
        <input
          id="new-project-name"
          autoFocus
          type="text"
          required
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        {duplicateWarning && (
          <p {...warningFeedbackProps} className={warningClass}>{t(lang, i18nProjects.createDuplicateWarning)}</p>
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
        <ColorPicker
          name="project-color-new"
          value={colorHex}
          onChange={setColorHex}
          disabled={pending}
          lang={lang}
        />
      </div>
      {error && <p {...errorFeedbackProps} className={errorClass}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? t(lang, i18nProjects.creating) : t(lang, i18nProjects.createProject)}
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
  const { showSuccess, showError } = useToast();
  const [editing, setEditing] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  // Ticket 042: this action previously had NO success feedback at all
  // (the ticket's own motivating example) — both outcomes now go through
  // the toast pattern, success auto-dismissing, error staying until
  // closed. Nothing about this action is a field-level validation error,
  // so unlike the create/rename forms below there's no inline case left.
  async function handleArchiveToggle() {
    setArchivePending(true);
    try {
      const repos = getRepositories();
      const nextArchived = !project.isArchived;
      await archiveProject(repos, project.id, nextArchived);
      onChanged({ ...project, isArchived: nextArchived });
      showSuccess(
        t(lang, nextArchived ? i18nProjects.archiveSuccess : i18nProjects.reactivateSuccess),
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nProjects.archiveToggleError));
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
    // Ticket 039: `group` here plus the actions wrapper's opacity classes
    // below implement the AK's hover/focus-reveal option for the two
    // per-row action buttons (the alternative to collapsing them into a
    // "⋯" menu — chosen since no menu/popover component exists anywhere
    // else in this repo to reuse, and this needs no outside-click/keyboard-
    // nav handling to get right). Default state is dimmed + smaller, NOT
    // hidden (opacity, not `hidden`/`display:none`) — the AK's own touch-
    // device fallback ("immer sichtbar aber kleiner/dezenter"): a touch
    // user with no `:hover` can still see and tap them, just at reduced
    // visual weight. `focus-within` on the actions wrapper (no `group-`
    // prefix needed — the buttons themselves are the focus target) covers
    // keyboard navigation independent of pointer hover.
    <li className="group flex flex-col gap-2 py-3">
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
        <div className="flex shrink-0 gap-1 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={() => setEditing(true)} className={rowActionButtonClass}>
            {t(lang, i18nProjects.edit)}
          </button>
          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={archivePending}
            className={rowActionButtonClass}
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
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(project.name);
  const [notes, setNotes] = useState(project.notes);
  // Same split as CreateProjectForm above: only the blocking "name
  // required" validation stays here; a renameProject() request failure
  // goes to a toast instead.
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
      showSuccess(t(lang, i18nProjects.saveSuccess));
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nProjects.saveError));
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
          autoFocus
          type="text"
          required
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        {duplicateWarning && (
          <p {...warningFeedbackProps} className={warningClass}>{t(lang, i18nProjects.editDuplicateWarning)}</p>
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
      {error && <p {...errorFeedbackProps} className={errorClass}>{error}</p>}
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
