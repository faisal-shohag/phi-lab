import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // Same `@/…` alias the app uses, so tests import modules by their real path.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only`'s real entry throws outside an RSC build; stub it so
      // server modules (e.g. the QuickJS grader) import cleanly under node.
      'server-only': fileURLToPath(new URL('./test-stubs/server-only.ts', import.meta.url)),
    },
  },
})
