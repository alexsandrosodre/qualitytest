import type {
  OccurrenceCategory,
  OccurrencePriority,
  ProjectRole,
  ProjectSuggestionResult,
  UserSummary,
} from '@qualitytest/shared';

/**
 * Reexports dos tipos do pacote compartilhado usados pela extensão, para manter
 * um único ponto de importação dentro de `src/lib`.
 */
export type {
  OccurrenceSummary,
  ProjectSuggestion,
  ProjectSuggestionResult,
} from '@qualitytest/shared';

/** Par de tokens devolvido por login/refresh. */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Resposta de `POST /auth/login` e `POST /auth/refresh`. */
export interface AuthResponse extends SessionTokens {
  user: UserSummary;
}

/** Vínculo do usuário com um projeto (`GET /auth/me`). */
export interface ProjectRef {
  projectId: string;
  name: string;
  code: string;
  role: ProjectRole;
}

/** Sessão persistida localmente pela extensão. */
export interface Session {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
  projects: ProjectRef[];
  /** Instante (epoch ms) de expiração do access token. */
  expiresAt: number;
}

/** Resposta de `GET /auth/me`. */
export interface MeResponse {
  user: UserSummary;
  projects: ProjectRef[];
}

/** Sugestão de projeto (alias do contrato compartilhado). */
export type SuggestionResult = ProjectSuggestionResult;

/** Dados técnicos coletados da aba em foco (nunca dados sensíveis). */
export interface PageDiagnostics {
  pageUrl: string;
  pageTitle: string;
  browserInfo: string;
  operatingSystemInfo: string;
  viewportInfo?: string;
}

/**
 * Payload de `POST /occurrences`. O autor NÃO é enviado: o servidor o atribui a
 * partir da sessão autenticada.
 */
export interface CreateOccurrencePayload {
  projectId: string;
  environmentId?: string;
  title: string;
  description?: string;
  categoryId: OccurrenceCategory;
  priority: OccurrencePriority;
  pageUrl?: string;
  pageTitle?: string;
  browserInfo?: string;
  operatingSystemInfo?: string;
  viewportInfo?: string;
  attachmentIds?: string[];
}

/** Anexo de screenshot guardado junto ao job da fila local. */
export interface OutboxAttachment {
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

/** Job da fila local (falhas de conexão), com idempotência estável. */
export interface OutboxJob {
  id: string;
  idempotencyKey: string;
  status: 'pendente';
  createdAt: number;
  expiresAt: number;
  payload: CreateOccurrencePayload;
  attachment?: OutboxAttachment;
}

/** Resposta de `POST /occurrences/:occurrenceId/attachments`. */
export interface AttachmentUpload {
  id: string;
  occurrenceId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  uploadUrl: string;
  expiresInSeconds: number;
}
