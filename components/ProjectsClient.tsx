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
import { useEffect, useState } from "react";
import {
  archiveProject,
  assignProjectMember,
  createProject,
  listProjectMembers,
  renameProject,
  setProjectRestricted,
  unassignProjectMember,
} from "@/lib/application/projects";
import { listWorkspaceMembers, type WorkspaceMemberRow } from "@/lib/application/workspace";
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

// Ticket 122 — projects are now workspace-wide shared resources (any
// member sees all of them), but creating/renaming/archiving stays
// role-gated server-side (owner/admin only, RLS's own sole authority —
// see the TimTracker-Starter migration's own comment). `canManageProjects`
// only controls whether these CONTROLS are shown at all — hiding a button
// that would otherwise just fail with a confusing permission error for a
// plain member, same reasoning as WorkspaceSettingsClient's own
// `canEdit` prop.
export function ProjectsClient({
  initialProjects,
  canManageProjects,
  workspaceId,
  lang,
}: {
  initialProjects: Project[];
  canManageProjects: boolean;
  workspaceId: string;
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
      {canManageProjects && (
        <CreateProjectSection
          projects={projects}
          onCreated={(project) => setProjects((prev) => [project, ...prev])}
          lang={lang}
        />
      )}

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
                    canManageProjects={canManageProjects}
                    workspaceId={workspaceId}
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
                canManageProjects={canManageProjects}
                workspaceId={workspaceId}
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
  canManageProjects,
  workspaceId,
  lang,
}: {
  project: Project;
  allProjects: Project[];
  onChanged: (project: Project) => void;
  canManageProjects: boolean;
  workspaceId: string;
  lang: Lang;
}) {
  const { showSuccess, showError } = useToast();
  const [editing, setEditing] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [managingAccess, setManagingAccess] = useState(false);

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
              {project.isRestricted && (
                <span className="ml-2 rounded bg-paper px-1.5 py-0.5 text-xs font-normal text-foreground/60">
                  {t(lang, i18nProjects.restricted)}
                </span>
              )}
            </p>
            {project.customer && (
              <p className="truncate text-xs text-foreground/60">{project.customer}</p>
            )}
          </div>
        </div>
        {canManageProjects && (
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
            <button type="button" onClick={() => setManagingAccess((prev) => !prev)} className={rowActionButtonClass}>
              {t(lang, i18nProjects.manageAccess)}
            </button>
          </div>
        )}
      </div>
      {project.notes && (
        <p className="truncate text-xs text-foreground/60">{project.notes}</p>
      )}
      {managingAccess && (
        <ProjectAccessPanel
          project={project}
          workspaceId={workspaceId}
          onChanged={onChanged}
          lang={lang}
        />
      )}
    </li>
  );
}

// Ticket 123 — "Zugriff verwalten": toggles project.isRestricted and (only
// while restricted) shows the workspace's member list with per-member
// assign/unassign checkboxes. Own component, own lazy fetch (the
// workspace member list is only ever needed once this panel is actually
// opened — most projects stay public forever, fetching it unconditionally
// for every row would be wasted work almost always).
function ProjectAccessPanel({
  project,
  workspaceId,
  onChanged,
  lang,
}: {
  project: Project;
  workspaceId: string;
  onChanged: (project: Project) => void;
  lang: Lang;
}) {
  const { showSuccess, showError } = useToast();
  const [restrictedPending, setRestrictedPending] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string> | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!project.isRestricted) return;
    let cancelled = false;
    (async () => {
      try {
        const repos = getRepositories();
        const [members, assigned] = await Promise.all([
          listWorkspaceMembers(repos, workspaceId),
          listProjectMembers(repos, project.id),
        ]);
        if (cancelled) return;
        setWorkspaceMembers(members);
        setAssignedUserIds(new Set(assigned.map((row) => row.userId)));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the panel switches into "restricted" mode (e.g.
    // right after the toggle below turns it on).
  }, [project.isRestricted, project.id, workspaceId]);

  async function handleRestrictedToggle() {
    setRestrictedPending(true);
    try {
      const repos = getRepositories();
      const nextRestricted = !project.isRestricted;
      await setProjectRestricted(repos, project.id, nextRestricted);
      onChanged({ ...project, isRestricted: nextRestricted });
      showSuccess(nextRestricted ? t(lang, i18nProjects.restrictSuccess) : t(lang, i18nProjects.unrestrictSuccess));
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nProjects.restrictToggleError));
    } finally {
      setRestrictedPending(false);
    }
  }

  async function handleMemberToggle(userId: string, isAssigned: boolean) {
    setPendingUserId(userId);
    try {
      const repos = getRepositories();
      if (isAssigned) {
        await unassignProjectMember(repos, project.id, userId);
      } else {
        await assignProjectMember(repos, project.id, userId);
      }
      setAssignedUserIds((prev) => {
        const next = new Set(prev);
        if (isAssigned) next.delete(userId);
        else next.add(userId);
        return next;
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nProjects.memberAssignmentError));
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-paper p-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={project.isRestricted}
          disabled={restrictedPending}
          onChange={handleRestrictedToggle}
        />
        {t(lang, i18nProjects.restrictedToggleLabel)}
      </label>
      {project.isRestricted && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground/60">{t(lang, i18nProjects.restrictedMembersHint)}</p>
          {loadError ? (
            <p className={errorClass}>{t(lang, i18nProjects.memberListLoadError)}</p>
          ) : workspaceMembers === null || assignedUserIds === null ? (
            <p className="text-xs text-foreground/60">{t(lang, i18nProjects.loadingMembers)}</p>
          ) : workspaceMembers.filter((member) => member.status === "active").length === 0 ? (
            <p className="text-xs text-foreground/60">{t(lang, i18nProjects.noWorkspaceMembers)}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {workspaceMembers
                .filter((member) => member.status === "active" && member.userId)
                .map((member) => {
                  const userId = member.userId as string;
                  const isAssigned = assignedUserIds.has(userId);
                  return (
                    <li key={userId} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        disabled={pendingUserId === userId}
                        onChange={() => handleMemberToggle(userId, isAssigned)}
                      />
                      <span className="truncate">{member.displayName ?? member.email}</span>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </div>
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
