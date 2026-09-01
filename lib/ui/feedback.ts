export const errorFeedbackProps = {
  role: "alert",
  "aria-live": "assertive",
} as const;

export const successFeedbackProps = {
  role: "status",
  "aria-live": "polite",
} as const;

// Non-blocking warnings (for example an allowed duplicate project name)
// need the same polite announcement behavior as success feedback, but are
// semantically distinct. Keeping a separate constant prevents callers from
// labelling warnings as successes merely to reuse the ARIA attributes.
export const warningFeedbackProps = {
  role: "status",
  "aria-live": "polite",
} as const;
