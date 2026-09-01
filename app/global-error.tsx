"use client";

import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";
import { errorRecovery, languageFromDocument } from "@/lib/ui/error-recovery";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const retryButton = useRef<HTMLButtonElement>(null);
  const lang = languageFromDocument(
    typeof document === "undefined" ? undefined : document.documentElement.lang,
  );

  useEffect(() => {
    retryButton.current?.focus();
  }, []);

  return (
    <html lang={lang}>
      <head>
        <title>{t(lang, errorRecovery.globalTitle)}</title>
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", color: "#181817", background: "#fafaf8" }}>
        <main
          aria-labelledby="global-error-title"
          style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", boxSizing: "border-box" }}
        >
          <div style={{ width: "100%", maxWidth: "480px", border: "1px solid #e8e8e3", borderRadius: "12px", background: "#fff", padding: "24px", boxSizing: "border-box" }}>
            <h1 id="global-error-title" style={{ margin: 0, fontSize: "22px" }}>
              {t(lang, errorRecovery.globalTitle)}
            </h1>
            <p style={{ margin: "12px 0 24px", lineHeight: 1.5, color: "#73736e" }}>
              {t(lang, errorRecovery.globalBody)}
            </p>
            <button
              ref={retryButton}
              type="button"
              onClick={retry}
              style={{ minHeight: "40px", border: 0, borderRadius: "6px", padding: "0 16px", background: "#5261e6", color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              {t(lang, errorRecovery.retry)}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
