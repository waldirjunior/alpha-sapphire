import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { assetPublicDir, visualBaselineDir, visualReportDir } from './e2e/support/checkoutPaths';

const PORT = Number(process.env.ALPHA_E2E_PORT ?? 5320);

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/support/globalSetup.ts',
  globalTeardown: './e2e/support/gallery.ts',
  outputDir: path.join(visualReportDir(), 'test-results'),
  snapshotPathTemplate: path.join(visualBaselineDir(), '{platform}', '{arg}{ext}'),
  fullyParallel: true,
  forbidOnly: true,
  timeout: 120_000,
  reporter: [['list'], ['html', { outputFolder: path.join(visualReportDir(), 'playwright'), open: 'never' }]],
  expect: {
    // Tolera ruído de rasterização entre execuções na mesma máquina; mudança de cena real passa muito disso.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002 },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 800, height: 480 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/visual.html`,
    env: { ALPHA_PUBLIC_DIR: assetPublicDir() },
    // Reaproveitar um servidor já aberto na porta poderia testar o código de outro checkout sem aviso.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
