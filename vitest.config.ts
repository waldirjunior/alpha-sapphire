import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['src/core/testing/setupBattleTables.ts'],
  },
});
