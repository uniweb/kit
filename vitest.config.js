import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Match how consumers actually build kit: Vite's React plugin uses the
  // automatic runtime, so JSX here should not need React in scope either.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    // Node is the default on purpose — several tests assert what happens when
    // there is no `document` (the SSR path). Files needing a DOM opt in with
    // an `@vitest-environment jsdom` docblock.
    environment: 'node',
  },
})
