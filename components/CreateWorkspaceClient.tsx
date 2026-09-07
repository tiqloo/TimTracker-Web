"use client";

// Ticket 100 — "Unternehmens-Workspace erstellen". Same Client-Component
// shape as CreateProjectForm in ProjectsClient.tsx: getRepositories()
// (lib/application/client.ts) + a use case from lib/application/*, never
// lib/repositories/* directly. A standalone page/component rather than
// folded into SettingsClient.tsx — workspace creation is a one-off,
// infrequent action with its own multi-step future (Ticket 103's
// workspace switcher, 102's invite flow), not a settings toggle.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganizationWorkspace } from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import { common, workspaces as i18nWorkspaces, t, type Lang } from "@/lib/i18n";
import { primaryButtonClass } from "@/lib/ui/button-styles";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

const WORKSPACE_NAME_MAX_LENGTH = 100;

export function CreateWorkspaceClient({ lang }: { lang: Lang }) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t(lang, i18nWorkspaces.nameRequiredError));
      return;
    }
    if (trimmedName.length > WORKSPACE_NAME_MAX_LENGTH) {
      setError(t(lang, i18nWorkspaces.nameTooLongError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      const workspace = await createOrganizationWorkspace(repos, trimmedName);
      showSuccess(t(lang, i18nWorkspaces.createSuccess));
      // Ticket 100's own AC: "kein Zwischenzustand, in dem der neue
      // Workspace existiert, aber nirgends sichtbar ist" — until Ticket
      // 103 (workspace switcher) exists, straight into "invite the first
      // teammate" (Ticket 102) is the most useful next step for a
      // freshly created, still-empty organization workspace — a full
      // "switch into it" experience is 103's own scope, not this one's.
      router.push(`/dashboard/workspaces/${workspace.id}/invite`);
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nWorkspaces.createError));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="new-workspace-name" className="text-sm font-medium">
          {t(lang, i18nWorkspaces.nameLabel)}
        </label>
        <input
          id="new-workspace-name"
          autoFocus
          type="text"
          required
          disabled={pending}
          placeholder={t(lang, i18nWorkspaces.namePlaceholder)}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && (
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? t(lang, i18nWorkspaces.creating) : t(lang, i18nWorkspaces.createButton)}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="rounded-md border border-line px-3 py-2 text-sm font-medium transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t(lang, common.cancel)}
        </button>
      </div>
    </form>
  );
}
