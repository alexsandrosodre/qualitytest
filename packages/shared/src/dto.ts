import type {
  EnvironmentType,
  GlobalRole,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  OccurrenceCategory,
  OccurrencePriority,
  OccurrenceStatus,
  ProjectRole,
  RegistrationStatus,
} from './enums';

/** Constantes globais da plataforma. */
export const API_PREFIX = 'api';
export const API_VERSION = '0.1.0';

/** Códigos de erro padronizados da API (`docs/architecture/contratos-api.md`, seção 16). */
export enum ApiErrorCode {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
}

/** Envelope de erro padronizado da API. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

/** Parâmetros de paginação (`docs/architecture/contratos-api.md`, seção 1). */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
}

/** Resultado paginado genérico. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Status simples de checagem de dependência. */
export type DependencyStatus = 'up' | 'down' | 'unknown';

/** Resposta do endpoint `GET /api/health`. */
export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: DependencyStatus;
  };
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  globalRole: GlobalRole | null;
  status: RegistrationStatus;
}

export interface ProjectMemberDTO {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  status: RegistrationStatus;
  addedBy: string;
  createdAt: string;
}

export interface ProjectEnvironmentDTO {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  type: EnvironmentType;
  status: RegistrationStatus;
}

export interface OccurrenceSummary {
  id: string;
  publicCode: string;
  projectId: string;
  environmentId: string | null;
  title: string;
  categoryId: OccurrenceCategory;
  priority: OccurrencePriority;
  status: OccurrenceStatus;
  reporterUserId: string;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Confiança da sugestão de projeto por domínio/URL (seção 6.2).
 * `alta` = correspondência única; `media` = mais de um candidato (ambíguo).
 */
export type ProjectSuggestionConfidence = 'alta' | 'media';

/** Sugestão de projeto a partir de uma URL — sempre confirmável pelo usuário. */
export interface ProjectSuggestion {
  projectId: string;
  name: string;
  confidence: ProjectSuggestionConfidence;
}

/** Resposta de `GET /projects/suggest?url=<url>` (seção 6.2 da especificação). */
export interface ProjectSuggestionResult {
  suggestions: ProjectSuggestion[];
  /** `true` quando mais de um projeto corresponde: exige seleção manual. */
  ambiguous: boolean;
}

export interface NotificationDestinationDTO {
  id: string;
  projectId: string;
  channel: NotificationChannel;
  destinationConfig: Record<string, unknown>;
  enabled: boolean;
}

export interface NotificationDeliveryDTO {
  id: string;
  occurrenceId: string;
  destinationId: string;
  idempotencyKey: string;
  status: NotificationDeliveryStatus;
  providerMessageId: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Evento publicado na fila de notificações (Etapa 8 consumirá de fato). */
export interface NotificationJobPayload {
  eventType: NotificationEventType;
  occurrenceId: string;
  projectId: string;
  destinationId?: string;
  /**
   * Código do evento de negócio (ex.: evento idempotente por ocorrência+destino).
   * Usado como base da chave de idempotência do worker.
   */
  idempotencyKey?: string;
}
