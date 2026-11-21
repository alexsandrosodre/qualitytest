#!/usr/bin/env node
/**
 * Smoke test pós-deploy do QUALITY TEST.
 *
 * Consulta `GET <API_BASE_URL>/health` (rota pública) e falha se a API não
 * responder `status: "ok"`. Útil após publicar uma nova versão para confirmar
 * que a aplicação subiu e que a conexão com o PostgreSQL está saudável.
 *
 * Variáveis:
 *   API_BASE_URL    - base da API (padrão: http://localhost:3333/api)
 *   SMOKE_RETRIES   - nº de tentativas (padrão: 5)
 *   SMOKE_DELAY_MS  - intervalo entre tentativas em ms (padrão: 3000)
 *
 * Uso: node scripts/smoke-test.mjs
 */
const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3333/api').replace(/\/+$/, '');
const retries = Number.parseInt(process.env.SMOKE_RETRIES ?? '5', 10) || 1;
const delayMs = Number.parseInt(process.env.SMOKE_DELAY_MS ?? '3000', 10) || 0;
const url = `${baseUrl}/health`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkOnce() {
  const response = await fetch(url, { headers: { accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const body = await response.json();

  if (body?.status !== 'ok') {
    throw new Error(`status "${body?.status}" (checks=${JSON.stringify(body?.checks)})`);
  }

  return body;
}

for (let attempt = 1; attempt <= retries; attempt += 1) {
  try {
    const body = await checkOnce();
    console.log(
      `OK ${url} — serviço=${body.service} versão=${body.version} checks=${JSON.stringify(body.checks)}`,
    );
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (attempt === retries) {
      console.error(`Smoke test FALHOU para ${url}: ${message}`);
      process.exit(1);
    }

    console.warn(
      `Tentativa ${attempt}/${retries} falhou (${message}); aguardando ${delayMs} ms...`,
    );
    await sleep(delayMs);
  }
}
