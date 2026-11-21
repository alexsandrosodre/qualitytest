import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração de testes E2E de navegador (P4).
 *
 * Projetos:
 *  - `web`: navega na aplicação Next.js (sobe `next dev` automaticamente).
 *  - `extension`: carrega a extensão Chrome MV3 (build em `apps/extension/dist`)
 *    em um contexto persistente e valida o service worker e o popup.
 *
 * A extensão precisa estar compilada antes do projeto `extension`:
 *   npm run build --workspace @qualitytest/extension
 * O script `npm run test:e2e` já executa esse build.
 */
const WEB_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'web',
      testDir: './e2e/web',
      use: { ...devices['Desktop Chrome'], baseURL: WEB_BASE_URL },
    },
    {
      name: 'extension',
      testDir: './e2e/extension',
    },
  ],
  webServer: {
    command: 'npm run dev:web',
    url: WEB_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
