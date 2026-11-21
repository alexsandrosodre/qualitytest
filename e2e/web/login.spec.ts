import { expect, test } from '@playwright/test';

/**
 * E2E da tela de login do frontend web.
 *
 * Não depende do backend: valida renderização e validação no cliente (zod).
 */
test.describe('Tela de login (web)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renderiza o formulário de login', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'QUALITY TEST' })).toBeVisible();
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('valida os campos obrigatórios no cliente', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('E-mail inválido.')).toBeVisible();
    await expect(page.getByText('A senha deve ter ao menos 8 caracteres.')).toBeVisible();
  });
});
