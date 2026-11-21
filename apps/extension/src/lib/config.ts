/**
 * Configuração da extensão QUALITY TEST.
 *
 * A URL da API é definida no BUILD (esbuild `define`, ver `build.mjs`). O valor
 * padrão aponta para o backend de desenvolvimento local. Para publicar contra o
 * domínio oficial, defina `QUALITYTEST_API_BASE_URL` no ambiente antes de
 * `npm run build` (o `host_permissions` do manifest é ajustado automaticamente).
 *
 * O domínio oficial de produção segue PENDENTE DE DEFINIÇÃO (seção 11 de
 * `docs/architecture/extensao-chrome.md`). Enquanto não definido, mantém-se o
 * backend local.
 */
declare const QUALITYTEST_API_BASE_URL: string | undefined;

const FALLBACK_API_BASE_URL = 'http://localhost:3333/api';

/** URL base da API consumida pela extensão (sem barra final). */
export const API_BASE_URL =
  typeof QUALITYTEST_API_BASE_URL === 'string' && QUALITYTEST_API_BASE_URL.trim() !== ''
    ? QUALITYTEST_API_BASE_URL.trim().replace(/\/+$/, '')
    : FALLBACK_API_BASE_URL;

/**
 * Chave da sessão autenticada (`chrome.storage.session`).
 *
 * A sessão (com os tokens) fica em `chrome.storage.session`, que é apenas em
 * MEMÓRIA: não é gravada em disco e é limpa ao encerrar o navegador. Ver
 * `lib/session.ts` para a justificativa de segurança.
 */
export const SESSION_STORAGE_KEY = 'qualitytest.session';

/** Chave da fila local (outbox) em `chrome.storage.local`. */
export const OUTBOX_STORAGE_KEY = 'qualitytest.outbox';

/** Tempo de vida dos jobs da fila local antes de serem descartados (24h). */
export const OUTBOX_TTL_MS = 24 * 60 * 60 * 1000;

/** Margem para renovação antecipada do access token (renova se faltar menos que isto). */
export const REFRESH_THRESHOLD_MS = 60 * 1000;
