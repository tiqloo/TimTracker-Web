import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Hexagonal-architecture boundary rules. These turn the layering rules
// documented in README.md/CLAUDE.md into build-breaking lint errors,
// instead of relying on manual review to catch a violation (one was
// found and fixed by hand on 2026-08-25 — this exists so the next one
// fails CI instead of needing another manual audit).
//
// IMPORTANT: a bare directory import like "@/lib/repositories" (no
// trailing "/index") does NOT match a glob pattern such as
// "**/lib/repositories/**" — minimatch requires something after the
// trailing slash. Every directory that must be blocked is therefore
// listed BOTH as an exact `paths` entry (bare form) AND covered by a
// `patterns` glob (nested-file form). Verified against the real bug this
// was written for: manually reintroducing `from "@/lib/repositories"` in
// lib/application/billing.ts and confirming `eslint` now fails on it,
// before writing this comment.
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
            {
              name: "@/lib/repositories",
              message:
                "app/ darf nicht lib/repositories/* importieren — nur lib/application/*.",
            },
            {
              name: "@/lib/repositories/index",
              message:
                "app/ darf nicht lib/repositories/* importieren — nur lib/application/*.",
            },
            {
              name: "@/lib/supabase",
              message: "app/ darf lib/supabase/* nie direkt importieren.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/repositories/**", "**/lib/supabase/**"],
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
    files: ["lib/application/**/*.ts"],
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
            {
              name: "@/lib/repositories",
              message:
                "lib/application/* darf nicht den Composition Root (lib/repositories, resolved zu index.ts) importieren, nur lib/repositories/repositories.ts.",
            },
            {
              name: "@/lib/repositories/index",
              message:
                "lib/application/* darf nicht den Composition Root importieren, nur lib/repositories/repositories.ts.",
            },
            {
              name: "@/lib/supabase",
              message: "lib/application/* darf lib/supabase/* nie importieren.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/repositories/supabase/**", "**/lib/supabase/**"],
              message:
                "lib/application/* darf nur lib/repositories/repositories.ts importieren, nie einen konkreten Adapter.",
            },
          ],
        },
      ],
    },
  },
  {
    // Driven ports (the .repository.ts interfaces + the pure aggregate):
    // must stay adapter-free. index.ts (the composition root) is
    // deliberately excluded — it's the one file allowed to know both
    // sides.
    files: ["lib/repositories/*.ts"],
    ignores: ["lib/repositories/index.ts"],
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
              group: ["**/lib/repositories/supabase/**", "**/lib/supabase/**"],
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
  ]),
]);

export default eslintConfig;
