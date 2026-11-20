/**
 * Configuração da extensão QUALITY TEST.
 *
 * A URL oficial de produção da API está PENDENTE DE DEFINIÇÃO (seção 11 de
 * `docs/architecture/extensao-chrome.md`). Enquanto isso, apontamos para o
 * backend de desenvolvimento local e restringimos `host_permissions` a ele em
 * `src/manifest.json`. Ao definir o domínio oficial, ajustar `API_BASE_URL` e o
 * respectivo `host_permissions`.
 */
export const API_BASE_URL = 'http://localhost:3333/api';

/** Chave da sessão autenticada em `chrome.storage.local`. */
export const SESSION_STORAGE_KEY = 'qualitytest.session';

/** Chave da fila local (outbox) em `chrome.storage.local`. */
export const OUTBOX_STORAGE_KEY = 'qualitytest.outbox';

/** Tempo de vida dos jobs da fila local antes de serem descartados (24h). */
export const OUTBOX_TTL_MS = 24 * 60 * 60 * 1000;

/** Margem para renovação antecipada do access token (renova se faltar menos que isto). */
export const REFRESH_THRESHOLD_MS = 60 * 1000;
