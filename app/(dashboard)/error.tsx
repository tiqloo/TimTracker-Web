"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";
import { errorRecovery, languageFromDocument } from "@/lib/ui/error-recovery";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/ui/button-styles";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const retryButton = useRef<HTMLButtonElement>(null);
  const lang = languageFromDocument(
    typeof document === "undefined" ? undefined : document.documentElement.lang,
  );

  useEffect(() => {
    retryButton.current?.focus();
  }, []);

  return (
    <main
      className="flex min-h-[60vh] items-center justify-center py-12"
      aria-labelledby="dashboard-error-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-danger/30 bg-surface p-6 shadow-sm">
        <div className="mb-4 h-1 w-12 rounded-full bg-danger" aria-hidden />
        <h1 id="dashboard-error-title" className="text-xl font-semibold tracking-tight">
          {t(lang, errorRecovery.dashboardTitle)}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">{t(lang, errorRecovery.body)}</p>
        {error.digest && (
          <p className="mt-3 text-xs text-text-secondary">
            {t(lang, errorRecovery.reference)}: <code>{error.digest}</code>
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button ref={retryButton} type="button" onClick={retry} className={primaryButtonClass}>
            {t(lang, errorRecovery.retry)}
          </button>
          <Link href="/dashboard" className={secondaryButtonClass}>
            {t(lang, errorRecovery.dashboard)}
          </Link>
        </div>
      </div>
    </main>
  );
}

