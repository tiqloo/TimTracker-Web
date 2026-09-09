"use client";

// Ticket 138 — first step of registration: "Für mich" (personal) vs. "Für
// mein Team" (company). Wraps RegisterForm.tsx rather than duplicating its
// account-creation logic: picking a path only ever changes which
// `defaultRedirectTo` RegisterForm is given (see that component's own
// comment) — everything else (email/password validation, Google OAuth,
// the confirmation-pending/already-registered screens) stays the exact
// same code for both paths.
//
// Local component state, not a URL step param: no navigation actually
// happens between "choice" and the form — this is one page swapping what
// it renders, matching AuthCard's "flat/simple on purpose" shell.
// app/(auth)/register/page.tsx only renders this wrapper when neither
// `?email=` nor `?redirectTo=` is present (see that file's comment) — the
// Ticket 102 invite flow skips the choice screen entirely and keeps
// rendering RegisterForm directly, unchanged.
import { useState } from "react";
import { RegisterForm } from "@/components/RegisterForm";
import { AuthCard } from "@/components/AuthCard";
import { registrationChoice as i18nChoice, t, type Lang } from "@/lib/i18n";
import { Building2, User } from "lucide-react";

type Step = "choice" | "personal" | "company";

const cardClass =
  "flex flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-5 text-left transition-colors hover:border-brand/50 hover:bg-brand-soft/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10";

export function RegistrationChoice({ lang, prefillEmail }: { lang: Lang; prefillEmail?: string }) {
  const [step, setStep] = useState<Step>("choice");

  if (step === "personal") {
    return <RegisterForm lang={lang} prefillEmail={prefillEmail} flowContext="personal" />;
  }
  if (step === "company") {
    return (
      <RegisterForm
        lang={lang}
        prefillEmail={prefillEmail}
        defaultRedirectTo="/register/company"
        flowContext="company"
      />
    );
  }

  return (
    <AuthCard title={t(lang, i18nChoice.title)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setStep("personal")} className={cardClass}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <User size={20} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="mt-1 font-semibold">{t(lang, i18nChoice.personalTitle)}</span>
          <span className="text-sm text-text-secondary">{t(lang, i18nChoice.personalSubtitle)}</span>
        </button>
        <button type="button" onClick={() => setStep("company")} className={cardClass}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <Building2 size={20} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="mt-1 font-semibold">{t(lang, i18nChoice.companyTitle)}</span>
          <span className="text-sm text-text-secondary">{t(lang, i18nChoice.companySubtitle)}</span>
        </button>
      </div>
    </AuthCard>
  );
}
