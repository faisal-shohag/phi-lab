// Test stub for the `server-only` marker package. Its real entry throws when
// bundled for the browser, which is how it guards server modules — but under
// vitest (node) we want server modules to import cleanly. Aliased in
// vitest.config.ts.
export {}
