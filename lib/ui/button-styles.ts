// Ticket 048 ("warm, minimal design system"): one shared source for the
// three button tiers the ticket's AK spells out —
//   Primary   — --brand fill, 40-44px tall, THE one important action in a
//               given context (e.g. "+ Neues Projekt")
//   Secondary — --surface + --line border, no fill (e.g. "Zeiteintrag
//               ändern")
//   Tertiary  — plain text, no container/border (e.g. "Zuordnen →")
// plus a Danger variant (not named in the ticket's own three-tier list,
// but explicitly asked for: "Bestehende ... dangerButtonClass-Konstanten
// ... auf dieses Drei-Stufen-Schema vereinheitlichen" — dangerButtonClass
// is one of the named existing consts). Danger reuses Primary's shape
// (same height/weight — a destructive confirm action needs the same
// visual prominence as a primary action, not less) just recolored with
// --danger instead of --brand, mirroring how SettingsClient's own
// pre-Ticket-048 comment already reasoned about giving the delete-confirm
// button that same weight.
//
// Before this ticket, every Client Component that needed a button style
// redefined its own near-identical local `buttonClass`/`primaryButtonClass`/
// `dangerButtonClass` string (AuthCard.tsx, ProjectsClient.tsx,
// SettingsClient.tsx, SupportClient.tsx, ManageSubscriptionButton.tsx,
// AssignTimeAction.tsx) — six-plus slightly different copies, per the
// ticket's own "Ausgangslage". This file is the new single definition;
// see each of those files' own comments for what stayed local (rowAction-
// ButtonClass in ProjectsClient.tsx — a deliberately different "invisible
// until hover" pattern from Ticket 039, not a three-tier button — and the
// calendar/date-range picker's tiny nav-arrow buttons, neither of which
// this three-tier scheme was designed to cover).
//
// Two sizes per weight: the default/"form" size (h-10 = 40px, the bottom
// of the ticket's 40-44px Primary spec — a deliberately compact pick,
// matching the ticket's own explicit "nicht überall große Buttons"/
// Linear-Raycast-dense feel rather than the roomier top of the range) for
// page-level form actions (Speichern, Neues Projekt, Löschen bestätigen,
// Abo verwalten, ...), and a `Small` variant (h-7 = 28px) for compact,
// inline, in-context actions (AssignTimeAction's per-row confirm/cancel,
// the calendar picker's Abbrechen/Anwenden) that were never meant to
// become full-size buttons — the ticket itself says so explicitly.
//
// transition-colors duration-150 on every variant is this ticket's
// animation-consistency requirement applied here too ("Hover-Übergänge
// auf 120-150ms vereinheitlichen") — buttons previously had no transition
// at all (an instant color snap on hover) except ProjectsClient's
// rowActionButtonClass, which already used duration-150's implicit
// default; this makes every button consistent with that, not just one.
//
// focus-visible ring: previously ONLY inputClass definitions (AuthCard.tsx
// etc.) and DashboardNav's own focusRingClass had a focus-visible ring —
// plain <button> elements across every form (Speichern/Abbrechen/Löschen
// etc.) had none at all. Folded the same ring pattern in here so that gap
// closes as a side effect of the consolidation, not as a separate pass.
const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const primaryButtonClass = `${BASE} h-10 px-4 text-sm bg-brand text-background hover:bg-brand/90`;
export const secondaryButtonClass = `${BASE} h-10 px-4 text-sm border border-line bg-surface text-foreground hover:bg-paper`;
// The user-specified light danger fill (#D94C4C) has only 4.127:1 against
// white, so white button text fails WCAG AA. Black clears it at 5.088:1 and
// also clears the lighter dark-mode danger token; keep the literal status
// color and choose the accessible foreground rather than silently darkening
// the shared token used by decorative status accents.
export const dangerButtonClass = `${BASE} h-10 px-4 text-sm bg-danger text-black hover:bg-danger/90`;
// Tertiary is deliberately NOT built on BASE — no height/padding/
// container at all, per the ticket's own "nur Text, kein Container"
// definition. Kept as a plain inline text style, same `disabled:`/focus
// affordances as the other tiers so keyboard/disabled behavior stays
// consistent even without a visible container. Deliberately has NO
// text-size class of its own (unlike the other variants) — Tailwind
// utilities are order-independent in specificity, so a caller appending
// its own text-sm/text-xs after this string can't reliably win over a
// text-size baked in here; every caller adds its own size instead (see
// AssignTimeAction.tsx's "Zuordnen"/AuthCard.tsx-adjacent usages).
export const tertiaryButtonClass =
  "font-medium text-brand outline-none transition-colors duration-150 hover:underline focus-visible:underline disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonSmallClass = `${BASE} h-7 px-2.5 text-xs bg-brand text-background hover:bg-brand/90`;
export const secondaryButtonSmallClass = `${BASE} h-7 px-2.5 text-xs border border-line bg-surface text-foreground hover:bg-paper`;
