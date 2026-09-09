"use client";

// Ticket 138 — company-onboarding form (step 2 of the "Für mein Team"
// registration flow, app/(auth)/register/company/page.tsx). Deliberately
// NOT a generalization of components/CreateWorkspaceClient.tsx (Ticket
// 100) into a shared component — the two differ in exactly the ways that
// matter here: this one switches the ACTIVE workspace to the new
// organization (Ticket 100's does not, see its own comment on why) and
// redirects into the general onboarding page rather than the invite
// page, since inviting teammates isn't this ticket's next step. Keeping
// them as two small, independent components avoids a shared component
// with two behavior-toggling booleans for a single call site each.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganizationWorkspace, switchActiveWorkspace } from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { workspaces as i18nWorkspaces, companyOnboarding as i18nCompany, t, type Lang } from "@/lib/i18n";
import { primaryButtonClass } from "@/lib/ui/button-styles";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-background/60 px-4 text-sm outline-none transition duration-150 placeholder:text-text-secondary/60 hover:border-foreground/20 focus:border-brand focus:bg-surface focus-visible:ring-4 focus-visible:ring-brand/10 disabled:opacity-50";

const WORKSPACE_NAME_MAX_LENGTH = 100;

export function CreateCompanyWorkspaceClient({ lang }: { lang: Lang }) {
  const router = useRouter();
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

    // Button stays disabled for the whole request (below) — the AK's
    // double-submit guard. The page-level "already owns an organization
    // workspace -> redirect away" check (page.tsx) is what covers a
    // reload or a revisit after a successful submit; this pending flag
    // only needs to cover the single in-flight request.
    setPending(true);
    try {
      const repos = getRepositories();
      const workspace = await createOrganizationWorkspace(repos, trimmedName);
      // Unlike Ticket 100's CreateWorkspaceClient, this IS switched to
      // active — the whole point of this onboarding step is "set up your
      // team's workspace", so the user should land in it, not still on
      // their personal one.
      await switchActiveWorkspace(repos, workspace.id);
      router.push("/dashboard/get-started");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, i18nWorkspaces.createError));
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="company-workspace-name" className="text-sm font-medium">
          {t(lang, i18nWorkspaces.nameLabel)}
        </label>
        <input
          id="company-workspace-name"
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
      <button type="submit" disabled={pending} className={`${primaryButtonClass} mt-1 h-12 w-full rounded-xl`}>
        {pending ? t(lang, i18nWorkspaces.creating) : t(lang, i18nCompany.submit)}
      </button>
    </form>
  );
}
