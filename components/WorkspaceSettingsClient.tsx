"use client";

// Ticket 117 — "Workspace-Einstellungen". Same Client-Component shape as
// CreateWorkspaceClient.tsx: getRepositories() (lib/application/client.ts)
// + use cases from lib/application/workspace.ts, never
// lib/repositories/* directly.
import { useEffect, useState } from "react";
import type {
  WeekStart,
  WorkspaceDateFormat,
  WorkspaceDefaultLanguage,
  WorkspaceSettings,
  WorkspaceTimeFormat,
} from "@/lib/application/workspace";
import {
  getWorkspaceLogoUrl,
  removeWorkspaceLogo,
  updateWorkspaceSettings,
  uploadWorkspaceLogo,
} from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import { workspaceSettings as i18n, t, type Lang } from "@/lib/i18n";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/ui/button-styles";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

const WORKSPACE_NAME_MAX_LENGTH = 100;
const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

// A small, dependency-free fallback for engines without
// `Intl.supportedValuesOf` (Baseline since 2023 in every evergreen
// browser, but not guaranteed in every runtime) — the timezone select
// still works, just with a shorter, common-zones-only list instead of
// erroring out entirely.
const FALLBACK_TIMEZONES = [
  "UTC",
  "Europe/Berlin",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

function availableTimezones(): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intl.supportedValuesOf isn't in every lib.d.ts target yet.
    const supportedValuesOf = (Intl as any).supportedValuesOf;
    if (typeof supportedValuesOf === "function") return supportedValuesOf("timeZone");
  } catch {
    // fall through to the static list below
  }
  return FALLBACK_TIMEZONES;
}

export function WorkspaceSettingsClient({
  workspaceId,
  initialSettings,
  canEdit,
  lang,
}: {
  workspaceId: string;
  initialSettings: WorkspaceSettings;
  canEdit: boolean;
  lang: Lang;
}) {
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(initialSettings.name);
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [defaultLanguage, setDefaultLanguage] = useState<WorkspaceDefaultLanguage>(initialSettings.defaultLanguage);
  const [weekStart, setWeekStart] = useState<WeekStart>(initialSettings.weekStart);
  const [dateFormat, setDateFormat] = useState<WorkspaceDateFormat>(initialSettings.dateFormat);
  const [timeFormat, setTimeFormat] = useState<WorkspaceTimeFormat>(initialSettings.timeFormat);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [logoPath, setLogoPath] = useState(initialSettings.logoPath);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const timezones = availableTimezones();

  useEffect(() => {
    if (!logoPath) return;
    let cancelled = false;
    (async () => {
      try {
        const repos = getRepositories();
        const url = await getWorkspaceLogoUrl(repos, logoPath);
        if (!cancelled) setLogoUrl(url);
      } catch {
        if (!cancelled) setLogoUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logoPath]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t(lang, i18n.nameRequiredError));
      return;
    }
    if (trimmedName.length > WORKSPACE_NAME_MAX_LENGTH) {
      setError(t(lang, i18n.nameTooLongError));
      return;
    }

    setSaving(true);
    try {
      const repos = getRepositories();
      const updated = await updateWorkspaceSettings(repos, workspaceId, {
        name: trimmedName,
        timezone,
        defaultLanguage,
        weekStart,
        dateFormat,
        timeFormat,
      });
      setName(updated.name);
      showSuccess(t(lang, i18n.saveSuccess));
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18n.saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLogoBusy(true);
    try {
      const repos = getRepositories();
      const path = await uploadWorkspaceLogo(repos, workspaceId, file);
      setLogoPath(path);
      showSuccess(t(lang, i18n.logoUploadSuccess));
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18n.logoUploadError));
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleLogoRemove() {
    setLogoBusy(true);
    try {
      const repos = getRepositories();
      await removeWorkspaceLogo(repos, workspaceId);
      setLogoPath(null);
      showSuccess(t(lang, i18n.logoRemoveSuccess));
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18n.logoRemoveError));
    } finally {
      setLogoBusy(false);
    }
  }

  const disabled = !canEdit || saving;

  return (
    <div className="flex flex-col gap-6">
      {!canEdit && <p className="text-xs text-text-secondary">{t(lang, i18n.readOnlyNotice)}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="workspace-settings-name" className="text-sm font-medium">
            {t(lang, i18n.nameLabel)}
          </label>
          <input
            id="workspace-settings-name"
            type="text"
            required
            disabled={disabled}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="workspace-settings-timezone" className="text-sm font-medium">
            {t(lang, i18n.timezoneLabel)}
          </label>
          <select
            id="workspace-settings-timezone"
            disabled={disabled}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={inputClass}
          >
            {timezones.includes(timezone) ? null : <option value={timezone}>{timezone}</option>}
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="workspace-settings-language" className="text-sm font-medium">
            {t(lang, i18n.defaultLanguageLabel)}
          </label>
          <select
            id="workspace-settings-language"
            disabled={disabled}
            value={defaultLanguage}
            onChange={(e) => setDefaultLanguage(e.target.value as WorkspaceDefaultLanguage)}
            className={inputClass}
          >
            <option value="de">{t(lang, i18n.languageDe)}</option>
            <option value="en">{t(lang, i18n.languageEn)}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="workspace-settings-week-start" className="text-sm font-medium">
            {t(lang, i18n.weekStartLabel)}
          </label>
          <select
            id="workspace-settings-week-start"
            disabled={disabled}
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value as WeekStart)}
            className={inputClass}
          >
            <option value="monday">{t(lang, i18n.weekStartMonday)}</option>
            <option value="sunday">{t(lang, i18n.weekStartSunday)}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="workspace-settings-date-format" className="text-sm font-medium">
            {t(lang, i18n.dateFormatLabel)}
          </label>
          <select
            id="workspace-settings-date-format"
            disabled={disabled}
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value as WorkspaceDateFormat)}
            className={inputClass}
          >
            <option value="DD.MM.YYYY">DD.MM.YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="workspace-settings-time-format" className="text-sm font-medium">
            {t(lang, i18n.timeFormatLabel)}
          </label>
          <select
            id="workspace-settings-time-format"
            disabled={disabled}
            value={timeFormat}
            onChange={(e) => setTimeFormat(e.target.value as WorkspaceTimeFormat)}
            className={inputClass}
          >
            <option value="24h">{t(lang, i18n.timeFormat24h)}</option>
            <option value="12h">{t(lang, i18n.timeFormat12h)}</option>
          </select>
        </div>

        {error && (
          <p {...errorFeedbackProps} className={errorMessageClass}>
            {error}
          </p>
        )}

        {canEdit && (
          <div>
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? t(lang, i18n.saving) : t(lang, i18n.saveButton)}
            </button>
          </div>
        )}
      </form>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground/70">{t(lang, i18n.logoTitle)}</h2>
        {logoPath && logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived Storage URL isn't a fit for next/image's static optimization pipeline.
          <img src={logoUrl} alt="" className="h-16 w-16 rounded-md border border-line object-contain" />
        ) : (
          <p className="text-xs text-text-secondary">{t(lang, i18n.logoEmptyState)}</p>
        )}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <label className={`${secondaryButtonClass} cursor-pointer`}>
              {logoBusy ? t(lang, i18n.logoUploading) : t(lang, i18n.logoUploadButton)}
              <input type="file" accept={LOGO_ACCEPT} onChange={handleLogoSelected} disabled={logoBusy} className="hidden" />
            </label>
            {logoPath && (
              <button type="button" onClick={handleLogoRemove} disabled={logoBusy} className={secondaryButtonClass}>
                {logoBusy ? t(lang, i18n.logoRemoving) : t(lang, i18n.logoRemoveButton)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
