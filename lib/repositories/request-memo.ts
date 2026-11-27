// GitHub #56: one page navigation in the dashboard used to fire the same
// read several times (3x get_workspace_settings, 2x workspace_memberships,
// 2x auth.getUser for /dashboard/history) because layout, page and the
// application functions each resolve user/workspace/settings on their own.
// The server `Repositories` instance is already shared per request
// (lib/application/server.ts wraps it in React's cache()), so memoizing
// selected READ methods on that instance removes the duplicates without
// touching the framework-free core.
//
// Rules:
// - only the listed methods are memoized, keyed by their arguments;
// - calling ANY other function on the same repository (a write such as
//   updateSettings, signOut, ...) clears the memo, so a later read in the
//   same request never sees stale data;
// - a rejected read is not cached (the next call retries).
export function withRequestMemo<T extends object>(repository: T, memoized: readonly (keyof T)[]): T {
  const memoizedNames = new Set<PropertyKey>(memoized);
  const results = new Map<string, Promise<unknown>>();

  return new Proxy(repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;

      if (memoizedNames.has(property)) {
        return (...args: unknown[]) => {
          const key = `${String(property)}:${JSON.stringify(args)}`;
          const cached = results.get(key);
          if (cached) return cached;
          const pending = Promise.resolve(value.apply(target, args));
          results.set(key, pending);
          pending.catch(() => {
            if (results.get(key) === pending) results.delete(key);
          });
          return pending;
        };
      }

      return (...args: unknown[]) => {
        results.clear();
        return value.apply(target, args);
      };
    },
  });
}
