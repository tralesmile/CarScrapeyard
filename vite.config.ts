import { defineConfig } from 'vitest/config';

// base './' so the same build works on our own site, inside web portals
// (Poki, CrazyGames) and inside Capacitor's native shell.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
