import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['src/core/testing/setupBattleTables.ts'],
    // e2e/ pertence ao Playwright (npm run test:e2e); o Vitest coletaria os *.spec.ts de lá.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/testing/**', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'rom/coverage',
      // Catraca do core puro (AGENTS.md: todo comportamento novo em src/core exige teste). Só sobe.
      thresholds: {
        'src/core/**': { lines: 95, statements: 95, branches: 85 },
      },
    },
  },
});
