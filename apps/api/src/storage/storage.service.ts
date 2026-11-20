import { randomUUID } from 'node:crypto';

/** Token de injeção do adaptador de storage. */
export const STORAGE_SERVICE = 'STORAGE_SERVICE';

/** Alvo de upload pré-assinado. */
export interface UploadTarget {
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

/** Alvo de download pré-assinado. */
export interface DownloadTarget {
  downloadUrl: string;
  expiresInSeconds: number;
}

/**
 * Abstração de armazenamento de anexos (seção 12/14): URLs assinadas com
 * expiração. Implementações: `S3StorageService` (S3 compatível) e
 * `InMemoryStorageService` (dev/testes sem S3).
 */
export interface StorageService {
  /** Monta uma chave única e previsível por ocorrência. */
  buildStorageKey(occurrenceId: string, fileName: string): string;
  /** Gera URL assinada de upload (PUT) com expiração. */
  createUploadUrl(input: {
    storageKey: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadTarget>;
  /** Gera URL assinada de leitura (GET) com expiração. */
  createDownloadUrl(input: {
    storageKey: string;
    expiresInSeconds: number;
  }): Promise<DownloadTarget>;
}

/** Sanitiza o nome do arquivo para compor a chave no storage. */
export function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/[/\\]+/g, '_');
  const safe = trimmed.replace(/[^A-Za-z0-9._-]+/g, '_');
  return safe.length === 0 ? 'arquivo' : safe.slice(0, 120);
}

/**
 * Adaptador em memória: NÃO persiste arquivos. Retorna URLs `memory://`
 * somente para desenvolvimento/testes, permitindo exercitar o fluxo sem S3.
 */
export class InMemoryStorageService implements StorageService {
  buildStorageKey(occurrenceId: string, fileName: string): string {
    return `occurrences/${occurrenceId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  }

  async createUploadUrl(input: {
    storageKey: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadTarget> {
    return {
      storageKey: input.storageKey,
      uploadUrl: `memory://upload/${encodeURIComponent(input.storageKey)}?expires=${input.expiresInSeconds}`,
      expiresInSeconds: input.expiresInSeconds,
    };
  }

  async createDownloadUrl(input: {
    storageKey: string;
    expiresInSeconds: number;
  }): Promise<DownloadTarget> {
    return {
      downloadUrl: `memory://download/${encodeURIComponent(input.storageKey)}?expires=${input.expiresInSeconds}`,
      expiresInSeconds: input.expiresInSeconds,
    };
  }
}
