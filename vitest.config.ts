import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // Same `@/…` alias the app uses, so tests import modules by their real path.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
