/**
 * Tipos das respostas da API do QUALITY TEST.
 *
 * Espelham as "views" expostas pelo backend (`*.mapper.ts`) e os DTOs de
 * `@qualitytest/shared`. Os enums de domínio são importados do pacote
 * compartilhado (nunca de `@prisma/client`).
 */
import type {
  AiSuggestionType,
  EnvironmentType,
  GlobalRole,
  OccurrenceCategory,
  OccurrencePriority,
  OccurrenceStatus,
  ProjectRole,
  RegistrationStatus,
} from '@qualitytest/shared';

export interface UserView {
  id: string;
  name: string;
  email: string;
  globalRole: GlobalRole | null;
  status: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface ProjectView {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemberView {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  status: RegistrationStatus;
  addedBy: string;
  createdAt: string;
}

export interface ProjectMemberListItem extends ProjectMemberView {
  userName: string;
  userEmail: string;
}

export interface ProjectEnvironmentView {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  type: EnvironmentType;
  status: RegistrationStatus;
}

export interface ProjectDomainMappingView {
  id: string;
  projectId: string;
  domainPattern: string;
  environmentId: string;
  enabled: boolean;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface ProjectRef {
  id: string;
  name: string;
  code: string;
}

export interface EnvironmentRef {
  id: string;
  name: string;
}

export interface OccurrenceSummaryView {
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

export interface OccurrenceCommentView {
  id: string;
  occurrenceId: string;
  userId: string;
  author: UserRef | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface OccurrenceAttachmentView {
  id: string;
  occurrenceId: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedBy: string;
  createdAt: string;
}

export interface OccurrenceHistoryView {
  id: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  actorUserId: string;
  actor: UserRef | null;
  createdAt: string;
}

export interface OccurrenceDetailView extends OccurrenceSummaryView {
  description: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  browserInfo: string | null;
  operatingSystemInfo: string | null;
  viewportInfo: string | null;
  reporter: UserRef | null;
  assignee: UserRef | null;
  project: ProjectRef | null;
  environment: EnvironmentRef | null;
  attachments: OccurrenceAttachmentView[];
  comments: OccurrenceCommentView[];
  history: OccurrenceHistoryView[];
}

export interface AttachmentUploadView extends OccurrenceAttachmentView {
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface AttachmentDownloadView {
  downloadUrl: string;
  expiresInSeconds: number;
}

/** Sugestão de IA (assistiva; aplicar exige confirmação humana). */
export interface AiSuggestionView {
  type: AiSuggestionType;
  value: string;
  confidence: number;
  rationale: string | null;
}

/** Análise de IA registrada para uma ocorrência. */
export interface AiAnalysisView {
  id: string;
  occurrenceId: string;
  provider: string;
  model: string;
  suggestions: AiSuggestionView[];
  createdAt: string;
}

/** Resposta de `GET /occurrences/:occurrenceId/ai-analyses`. */
export interface AiAnalysesResult {
  /** `false` quando o módulo de IA está desativado neste ambiente. */
  enabled: boolean;
  provider: string;
  model: string;
  items: AiAnalysisView[];
}

/** Resposta de `POST /auth/login` e `POST /auth/refresh`. */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserView;
}

export interface MeUser {
  id: string;
  name: string;
  email: string;
  globalRole: GlobalRole | null;
  status: RegistrationStatus;
}

export interface MeMembership {
  projectId: string;
  name: string;
  code: string;
  role: ProjectRole;
}

/** Resposta de `GET /auth/me`. */
export interface MeResult {
  user: MeUser;
  projects: MeMembership[];
}
