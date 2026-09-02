/// <reference types="vitest/globals" />

// `vitest.config.ts` sets `globals: true` because the `.spec.ts` suites call
// `describe` / `it` / `expect` / `vi` without importing them. This reference
// makes the compiler agree with the runtime.
//
// It lives under `src/` deliberately: `tsconfig.json` only includes
// `next-env.d.ts` and `src/**`, so a root-level declaration file would be
// silently ignored.
export {};
