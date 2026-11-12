import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.mjs so tests do not load the PWA/Capacitor
// build plugins. Node-runner source checks still live in tests/.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    restoreMocks: true,
    setupFiles: ['tests/setup/vitest.setup.js'],
  },
})
