import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Hexagonal-architecture boundary rules. These turn the layering rules
// documented in README.md/CLAUDE.md into build-breaking lint errors,
// instead of relying on manual review to catch a violation (one was
// found and fixed by hand on 2026-08-25 — this exists so the next one
// fails CI instead of needing another manual audit).
//
// IMPORTANT: a bare directory/file import like "@/lib/composition-root"
// or "@/lib/repositories" (no trailing "/index") does NOT match a glob
// pattern such as "**/lib/repositories/**" — minimatch requires
// something after the trailing slash. Every module that must be blocked
// is therefore listed BOTH as an exact `paths` entry (bare form) AND
// covered by a `patterns` glob (nested-file form). Verified against the
// real bug this was originally written for: manually reintroducing
// `from "@/lib/repositories"` in lib/application/billing.ts and
// confirming `eslint` failed on it, before writing this comment.
const supabasePackages = ["@supabase/supabase-js", "@supabase/ssr"];

const architectureBoundaries = defineConfig([
  {
    // Driving adapter (UI): may only call the application core.
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...supabasePackages.map((name) => ({
              name,
              message:
                "app/ darf nie Supabase direkt importieren — nur lib/application/* (Hexagonal-Grenze, siehe CLAUDE.md).",
            })),
            ...["@/lib/composition-root", "@/lib/composition-root.client", "@/lib/composition-root.server"].map(
              (name) => ({
                name,
                message:
                  "app/ darf nicht den Composition Root importieren — nur lib/application/*.",
              }),
            ),
            {
              name: "@/lib/supabase",
              message: "app/ darf lib/supabase/* nie direkt importieren.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/repositories/**", "**/lib/supabase/**", "**/supabase/**"],
              message:
                "app/ darf nur lib/application/* importieren, nie lib/repositories/* oder lib/supabase/* direkt (Hexagonal-Grenze, siehe CLAUDE.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // Application core: may only depend on the pure port aggregate
    // (lib/repositories/repositories.ts), never the composition root or
    // any concrete adapter.
    //
    // EXCEPTION: lib/application/client.ts and lib/application/server.ts
    // are excluded here (see the dedicated block below) — they are the
    // one designated, documented place allowed to import the composition
    // root, because pages have no other allowed way to obtain a
    // `Repositories` instance (app/* may only import lib/application/*,
    // never lib/composition-root.ts or lib/repositories/* directly).
    // Introduced 2026-08-25 while implementing Ticket 018's auth pages —
    // see the comment at the top of lib/application/client.ts for the
    // full reasoning.
    files: ["lib/application/**/*.ts"],
    ignores: ["lib/application/client.ts", "lib/application/server.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...supabasePackages.map((name) => ({
              name,
              message:
                "lib/application/* (der Kern) darf Supabase nie kennen — nur lib/repositories/repositories.ts (reine Ports).",
            })),
            ...["@/lib/composition-root", "@/lib/composition-root.client", "@/lib/composition-root.server"].map(
              (name) => ({
                name,
                message:
                  "lib/application/* darf nicht den Composition Root importieren, nur lib/repositories/repositories.ts. Ausnahme: lib/application/client.ts bzw. server.ts, siehe dortigen Kommentar.",
              }),
            ),
            {
              name: "@/lib/supabase",
              message: "lib/application/* darf lib/supabase/* nie importieren.",
            },
          ],
          patterns: [
            {
              group: [
                "**/lib/repositories/supabase/**",
                "**/lib/repositories/cookie/**",
                "**/lib/supabase/**",
                "**/supabase/**",
                "./supabase/**",
              ],
              message:
                "lib/application/* darf nur lib/repositories/repositories.ts importieren, nie einen konkreten Adapter.",
            },
          ],
        },
      ],
    },
  },
  {
    // The designated exception: client.ts/server.ts may import the
    // composition root (that's their entire purpose — see their own
    // comments), but must still never reach past it into a concrete
    // adapter or Supabase directly. Keeping this as its own block (rather
    // than just turning the rule off for these files) preserves that
    // second guarantee.
    files: ["lib/application/client.ts", "lib/application/server.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: supabasePackages.map((name) => ({
            name,
            message:
              "Auch lib/application/client.ts|server.ts dürfen Supabase nicht direkt importieren — nur über lib/composition-root.ts.",
          })),
          patterns: [
            {
              group: [
                "**/lib/repositories/supabase/**",
                "**/lib/repositories/cookie/**",
                "**/lib/supabase/**",
                "**/supabase/**",
                "./supabase/**",
              ],
              message:
                "Auch lib/application/client.ts|server.ts dürfen keinen konkreten Adapter direkt importieren — nur über lib/composition-root.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    // Driven ports (the .repository.ts interfaces + the pure aggregate):
    // must stay adapter-free. lib/composition-root.client.ts and
    // lib/composition-root.server.ts (split 2026-08-25, see their own
    // comments) are the only modules allowed to know both sides, and
    // live outside lib/repositories/ so this glob doesn't need to
    // exclude anything.
    files: ["lib/repositories/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...supabasePackages.map((name) => ({
              name,
              message:
                "Port-Interfaces (lib/repositories/*.repository.ts, repositories.ts) müssen adapterfrei bleiben.",
            })),
            {
              name: "@/lib/supabase",
              message: "Port-Interfaces dürfen lib/supabase/* nicht importieren.",
            },
          ],
          patterns: [
            {
              group: [
                "**/lib/repositories/supabase/**",
                "**/lib/repositories/cookie/**",
                "**/lib/supabase/**",
                "**/supabase/**",
                "./supabase/**",
              ],
              message:
                "Port-Interfaces dürfen keine konkrete Adapter-Implementierung importieren.",
            },
          ],
        },
      ],
    },
  },
]);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...architectureBoundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated by `vercel build`/`vercel deploy` — gitignored, not source.
    ".vercel/**",
  ]),
]);

export default eslintConfig;
