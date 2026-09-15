// Pure CSP-string builder, extracted out of proxy.ts (Ticket 190) for the
// same reason proxy-routing.ts already exists: proxy.ts imports
// "next/server", which plain `node --test` can't resolve outside Next's
// own bundler — so anything worth unit-testing there has to live in a
// framework-free module instead. See proxy.ts's own buildCsp() call site
// for the full history/reasoning behind each directive.
export function buildCsp(supabaseUrl: string, nonce: string): string {
  const supabaseHost = new URL(supabaseUrl).origin;
  // CSP source matching is scheme-sensitive — an `https://` entry does
  // NOT also permit a `wss://` connection to the same host. Ticket 190
  // (selbst gefunden): supabase-js Realtime opens exactly such a
  // WebSocket (lib/composition-root.client.ts's
  // "today-time-entry-changes" channel) directly to this host; without
  // this entry every browser blocks it outright.
  const supabaseWsHost = supabaseHost.replace(/^http/, "ws");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    `connect-src 'self' ${supabaseHost} ${supabaseWsHost}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
