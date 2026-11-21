import { existsSync } from 'node:fs';
import path from 'node:path';

import { chromium, expect, test as base, type BrowserContext } from '@playwright/test';

/**
 * E2E da extensão Chrome (Manifest V3).
 *
 * Carrega a extensão compilada em um contexto persistente do Chromium e valida:
 *  - o registro do service worker (background);
 *  - a abertura do popup sem sessão (formulário de login renderiza).
 *
 * Requer a extensão compilada. O script `npm run test:e2e` já faz esse build.
 */
const extensionPath = path.resolve(__dirname, '..', '..', 'apps', 'extension', 'dist');

if (!existsSync(extensionPath)) {
  throw new Error(
    `Extensão não encontrada em ${extensionPath}. ` +
      'Rode "npm run build --workspace @qualitytest/extension" antes dos testes E2E.',
  );
}

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // O Playwright exige o padrão de destructuring no 1º argumento, mesmo sem fixtures usadas.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      // Extensões exigem um navegador "de verdade" (não headless) para o service worker MV3.
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const existing = context.serviceWorkers()[0];
    const serviceWorker = existing ?? (await context.waitForEvent('serviceworker'));
    const id = serviceWorker.url().split('/')[2] ?? '';
    await use(id);
  },
});

test.describe('Extensão Chrome (MV3)', () => {
  test('registra o service worker da extensão', async ({ context, extensionId }) => {
    expect(extensionId).not.toBe('');
    expect(context.serviceWorkers().length).toBeGreaterThan(0);
  });

  test('abre o popup e exibe o formulário de login quando não há sessão', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.getByRole('heading', { name: 'QUALITY TEST' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });
});
