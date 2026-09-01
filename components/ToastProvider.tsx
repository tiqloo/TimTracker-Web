"use client";

// Ticket 042 (TimTracker-Starter repo): one reusable toast/notification
// pattern, replacing the ad hoc success/error feedback every Client
// Component previously built for itself (SettingsClient.tsx's ProfileSection
// showed inline "saved" text, ProjectsClient.tsx's archive toggle had no
// success feedback at all, errors everywhere reused the same inline
// `errorClass` block). No external toast library — same "a small own
// implementation is enough" call this repo already made for the bar chart
// (Ticket 002) and lib/i18n.ts (Ticket 022): a plain React Context plus a
// fixed-position container.
//
// Mounted ONCE in app/(dashboard)/layout.tsx, wrapping every (dashboard)/*
// page — not per-page — for two reasons: (1) every Client Component that
// wants a toast needs the same useToast() hook regardless of which page
// it's rendered on, and (2) that layout persists across client-side
// navigation within the dashboard route group (Next.js App Router only
// remounts a layout when you navigate to a route outside its group), so a
// toast fired right before a `router.push`/`router.refresh()` keeps running
// its own dismiss timer instead of being torn down mid-flight by the page
// component that triggered it unmounting. It's still scoped to the
// (dashboard)/* tree, not the root layout — nothing outside it (marketing
// homepage, (auth)/* pages) has a save/error action that needs a toast yet.
//
// Success vs. error dismissal (ticket AK, mirrors this repo's existing
// errorClass convention of never being modal/blocking): success toasts
// auto-dismiss after a few seconds, matching how transient feedback like
// ProfileSection's old inline "Gespeichert." text already behaved. Error
// toasts stay until manually closed — losing an error message to a timer
// before the user has read it would be worse than the inconsistent inline
// errorClass blocks this replaces, which never auto-dismissed either.
//
// Stacking (ticket's own edge case: "zwei Projekte schnell hintereinander
// archiviert -> Toasts stapeln sich lesbar, ersetzen sich nicht gegenseitig
// unsichtbar"): toasts are stored as a list, each with its own id and own
// dismiss timer, rendered as a flex column — nothing about firing a new
// toast affects an existing one's state or timer.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { common, t, type Lang } from "@/lib/i18n";

export type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Long enough to read a short confirmation sentence, short enough to not
// linger and start feeling like clutter — same rough window most toast
// systems default to.
const SUCCESS_AUTO_DISMISS_MS = 4000;

// Module-level counter rather than crypto.randomUUID()/useId(): toasts are
// purely client-side, ephemeral, and never need to match a server-rendered
// id (unlike useId(), which exists specifically to keep SSR/hydration
// output stable — irrelevant here since ToastProvider renders no toasts
// on the server, the list starts empty). A plain incrementing counter is
// simpler and unique enough for "distinguish concurrently visible toasts
// in one browser tab".
let nextToastId = 0;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export function ToastProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextToastId++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      if (kind === "success") {
        const timer = setTimeout(() => dismiss(id), SUCCESS_AUTO_DISMISS_MS);
        timers.current.set(id, timer);
      }
      // Error toasts intentionally get no timer here — dismiss() only
      // ever runs for them via the close button's onClick below.
    },
    [dismiss],
  );

  const showSuccess = useCallback((message: string) => show("success", message), [show]);
  const showError = useCallback((message: string) => show("error", message), [show]);

  // Belt-and-braces cleanup for the rare full unmount (navigating away
  // from the (dashboard)/* route group entirely, e.g. logout) — avoids a
  // "set state on an unmounted component" warning from a pending success
  // timer firing after the fact.
  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      for (const timer of timerMap.values()) {
        clearTimeout(timer);
      }
      timerMap.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} lang={lang} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  lang,
  onDismiss,
}: {
  toast: ToastItem;
  lang: Lang;
  onDismiss: () => void;
}) {
  const isError = toast.kind === "error";
  return (
    <div
      // role="status"/"alert" each already establish their own live
      // region (assertive for "alert", polite for "status") — no
      // additional aria-live on the wrapping container above, to avoid
      // the message being announced twice.
      role={isError ? "alert" : "status"}
      // Ticket 048: this is one of the two places the ticket's AK names
      // explicitly for the new status tokens ("... vereinheitlichen, wo
      // diese Zustände vorkommen: DeleteAccountSection, ToastProvider,
      // Fehlermeldungen"). border/bg now use --danger/--success
      // (decorative accent use — see globals.css's --danger/--success
      // comment for why these two aren't used as the message TEXT color;
      // the actual message text stays the already-AA-passing text-red-700/
      // dark:text-red-400 pair for the error case, and the existing
      // neutral text-foreground for success — unchanged from before,
      // since coloring the success message text itself was never this
      // pattern's design). Success previously reused --brand/bg-brand
      // specifically to avoid introducing a new green (Ticket 042's own
      // reasoning, quoted there) — Ticket 048's user-specified Farb-System
      // now gives this product an actual --success color as one of its
      // fixed tokens, so that reasoning is superseded: a real "success"
      // toast can now use the real success color instead of overloading
      // the brand accent for a state that isn't actually about branding.
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border px-3 py-2 text-sm shadow-[0_4px_16px_-4px_rgba(24,24,23,0.12)] ${
        isError
          ? "border-danger/30 bg-danger/10 text-red-700 dark:text-red-400"
          : "border-success/30 bg-success/10 text-foreground"
      }`}
    >
      <p className="flex-1">{toast.message}</p>
      {isError && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t(lang, common.close)}
          className="shrink-0 text-red-700/70 hover:text-red-700 dark:text-red-400/70 dark:hover:text-red-400"
        >
          ×
        </button>
      )}
    </div>
  );
}
