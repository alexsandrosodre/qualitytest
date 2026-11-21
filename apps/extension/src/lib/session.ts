import { SESSION_STORAGE_KEY } from './config';
import type { Session } from './types';

/**
 * Persistência da sessão autenticada.
 *
 * A sessão (com `accessToken`/`refreshToken`) é guardada em
 * `chrome.storage.session`, que atende ao requisito de "não armazenar tokens em
 * local inseguro":
 *
 *  - ISOLADO da página: scripts do site em teste (conteúdo e terceiros) não têm
 *    acesso a este storage — diferente de `localStorage`, exposto ao JavaScript
 *    da própria página.
 *  - SOMENTE EM MEMÓRIA: não é gravado em disco e é limpo quando o navegador é
 *    encerrado — diferente de `chrome.storage.local`, que persiste em disco e
 *    sobrevive ao reinício.
 *  - Acesso restrito aos contextos confiáveis da extensão (service worker e
 *    páginas da própria extensão) por padrão.
 *
 * Requer Chrome 102+ (declarado em `minimum_chrome_version` no manifest).
 * A interface abaixo isola o restante do código do mecanismo de armazenamento.
 */

/** Área de armazenamento em memória usada para a sessão. */
function storage(): chrome.storage.StorageArea {
  return chrome.storage.session;
}

/** Lê a sessão persistida; retorna `null` se ausente ou inválida. */
export async function readSession(): Promise<Session | null> {
  const stored = await storage().get(SESSION_STORAGE_KEY);
  const value = stored[SESSION_STORAGE_KEY];
  return isSession(value) ? value : null;
}

/** Grava (ou sobrescreve) a sessão persistida. */
export async function writeSession(session: Session): Promise<void> {
  await storage().set({ [SESSION_STORAGE_KEY]: session });
}

/** Remove a sessão persistida. */
export async function clearSession(): Promise<void> {
  await storage().remove(SESSION_STORAGE_KEY);
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.expiresAt === 'number' &&
    typeof candidate.user === 'object' &&
    candidate.user !== null &&
    Array.isArray(candidate.projects)
  );
}
