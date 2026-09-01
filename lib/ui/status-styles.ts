// Ticket 048: the ticket's AK names "Fehlermeldungen" (error messages)
// alongside DeleteAccountSection/ToastProvider (see button-styles.ts's own
// header comment for that pair) as a place the new --danger/--success
// status tokens should replace ad hoc Tailwind color utilities. Before
// this ticket, five near-identical local `errorClass`/`authErrorClass`
// consts (ProjectsClient.tsx, SettingsClient.tsx, ManageSubscriptionButton.tsx,
// AuthCard.tsx) all hardcoded the same "bg-red-500/10 ... text-red-700
// dark:text-red-400" string, plus one `authSuccessClass` using the green-500
// scale directly.
//
// Same split as ToastProvider.tsx's own Ticket 048 treatment: the
// background/border tint moves onto the new --danger/--success tokens
// (decorative use — see globals.css's comment on those two tokens for why
// they aren't used as message TEXT color), the message text itself KEEPS
// the already-AA-passing text-red-700/dark:text-red-400 (error) /
// text-green-700/dark:text-green-400 (success) pairs unchanged — no real
// contrast regression introduced by this consolidation.
export const errorMessageClass =
  "rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-red-700 dark:text-red-400";

export const successMessageClass =
  "rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-green-700 dark:text-green-400";
