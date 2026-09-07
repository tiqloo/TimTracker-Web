// Driven port for the persisted "which workspace is currently active"
// preference (Ticket 103). Same cookie-backed shape as
// language.repository.ts/daily-goal.repository.ts on purpose — same kind
// of per-visitor preference, same precedent to follow.
//
// Deliberately just the raw, UNVALIDATED stored value — `get()` may return
// a workspace id the caller is no longer a member of (removed since the
// cookie was set) or one that no longer exists at all. Resolving that
// against the caller's actual memberships (with a fallback to their
// personal workspace) is lib/repositories/workspace.repository.ts's
// resolveWorkspaceIdWithFallback()'s job, not this port's — this port only
// knows how to read/write the cookie itself.
export interface ActiveWorkspaceRepository {
  get(): Promise<string | null>;
  set(workspaceId: string): Promise<void>;
}
