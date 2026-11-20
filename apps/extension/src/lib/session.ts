import { SESSION_STORAGE_KEY } from './config';
import type { Session } from './types';

/**
 * Persistência da sessão autenticada.
 *
 * Usamos `chrome.storage.local`, que é ISOLADO da página: scripts do site em
 * teste (conteúdo e terceiros) não têm acesso a este storage — diferente de
 * `localStorage`, que ficaria exposto ao JavaScript da própria página.
 *
 * ATENÇÃO: o mecanismo de armazenamento SEGURO do token na extensão está
 * PENDENTE DE DEFINIÇÃO (seção 11 do doc de estratégia). A escolha atual
 * (`chrome.storage.local`) evita exposição à página, mas não é criptografada em
 * disco. Caso o requisito evolua para um cofre/criptografia dedicada, migrar
 * a implementação sem alterar a interface abaixo.
 */

/** Lê a sessão persistida; retorna `null` se ausente ou inválida. */
export async function readSession(): Promise<Session | null> {
  const stored = await chrome.storage.local.get(SESSION_STORAGE_KEY);
  const value = stored[SESSION_STORAGE_KEY];
  return isSession(value) ? value : null;
}

/** Grava (ou sobrescreve) a sessão persistida. */
export async function writeSession(session: Session): Promise<void> {
  await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session });
}

/** Remove a sessão persistida. */
export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(SESSION_STORAGE_KEY);
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
