"use client";

// Ticket 195 — soft-deletes one entry (two-step reveal: "Löschen" link ->
// inline "Wirklich löschen?" confirm, same shape as every other small
// inline action on this page, never a native confirm()/modal). Renders on
// EVERY entry row, same universality as EditTimeEntryAction.tsx.
import { useState } from "react";
import { deleteTimeEntry } from "@/lib/application/dashboard";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import { common, dayDetail, t, type Lang } from "@/lib/i18n";
import { dangerButtonSmallClass, secondaryButtonSmallClass, tertiaryButtonClass } from "@/lib/ui/button-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

const linkButtonClass = `${tertiaryButtonClass} text-xs`;

export function DeleteTimeEntryAction({
  entryId,
  lang,
  onDeleted,
}: {
  entryId: string;
  lang: Lang;
  onDeleted: (deletedId: string) => void;
}) {
  const { showSuccess, showError } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={linkButtonClass}>
        {t(lang, dayDetail.deleteAction)}
      </button>
    );
  }

  async function handleConfirm() {
    setPending(true);
    try {
      const repos = getRepositories();
      await deleteTimeEntry(repos, entryId);
      onDeleted(entryId);
      showSuccess(t(lang, dayDetail.deleteSuccess));
      // No setConfirming(false)/setPending(false) on success — the row
      // itself disappears from the parent's list right after onDeleted(),
      // so there is nothing left here to reset.
    } catch {
      showError(t(lang, dayDetail.deleteError));
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span {...errorFeedbackProps} className="text-foreground/70">
        {t(lang, dayDetail.deleteConfirmPrompt)}
      </span>
      <button type="button" onClick={handleConfirm} disabled={pending} className={dangerButtonSmallClass}>
        {pending ? t(lang, common.saving) : t(lang, dayDetail.deleteConfirm)}
      </button>
      <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={secondaryButtonSmallClass}>
        {t(lang, common.cancel)}
      </button>
    </div>
  );
}
