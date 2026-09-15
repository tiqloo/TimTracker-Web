import assert from "node:assert/strict";
import test from "node:test";
import { buildCsp } from "./csp.ts";

test("buildCsp allows both https:// and wss:// to the Supabase host, not just https://", () => {
  // Ticket 190 (selbst gefunden): CSP source matching is scheme-sensitive
  // — an entry for one scheme does not implicitly cover another, even to
  // the same host. supabase-js Realtime (lib/composition-root.client.ts)
  // opens a `wss://` WebSocket; without an explicit wss:// entry here,
  // every browser blocks it and any UI awaiting that subscription's
  // initial connection hangs forever.
  const csp = buildCsp("https://hqqjwbeageoifilpqfso.supabase.co", "nonce123");
  const connectSrc = csp.split("; ").find((directive) => directive.startsWith("connect-src"));
  assert.ok(connectSrc, "connect-src directive must be present");
  assert.match(connectSrc!, /https:\/\/hqqjwbeageoifilpqfso\.supabase\.co/);
  assert.match(connectSrc!, /wss:\/\/hqqjwbeageoifilpqfso\.supabase\.co/);
});

test("buildCsp derives ws:// (not wss://) for a plain http:// local dev Supabase URL", () => {
  const csp = buildCsp("http://127.0.0.1:54321", "nonce123");
  const connectSrc = csp.split("; ").find((directive) => directive.startsWith("connect-src"));
  assert.match(connectSrc!, /ws:\/\/127\.0\.0\.1:54321/);
  assert.doesNotMatch(connectSrc!, /wss:\/\/127\.0\.0\.1:54321/);
});

test("buildCsp embeds the given nonce in script-src", () => {
  const csp = buildCsp("https://example.supabase.co", "the-nonce-value");
  assert.match(csp, /script-src 'self' 'nonce-the-nonce-value' 'strict-dynamic'/);
});
