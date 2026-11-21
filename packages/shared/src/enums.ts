/**
 * Enums de domínio do QUALITY TEST.
 *
 * Derivação: seções 3.2, 5.2, 5.3, 5.4, 11 e 12 da especificação mestra e
 * `docs/architecture/modelo-de-dados.md`.
 */

/** Perfil global do usuário (seção 3.2). */
export enum GlobalRole {
  ADMINISTRADOR = 'ADMINISTRADOR',
}

/** Perfis por projeto, atribuídos via `ProjectMember` (seções 2.3 e 3.2). */
export enum ProjectRole {
  GESTOR = 'GESTOR',
  TESTADOR = 'TESTADOR',
  DESENVOLVEDOR = 'DESENVOLVEDOR',
}

/** Status de registro genérico (soft delete / desativação lógica). */
export enum RegistrationStatus {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
}

/** Prioridades de ocorrência (seção 5.3). */
export enum OccurrencePriority {
  CRITICA = 'CRITICA',
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
  BAIXA = 'BAIXA',
}

/** Status da ocorrência (seção 5.4). */
export enum OccurrenceStatus {
  ABERTO = 'ABERTO',
  EM_ANALISE = 'EM_ANALISE',
  EM_DESENVOLVIMENTO = 'EM_DESENVOLVIMENTO',
  AGUARDANDO_HOMOLOGACAO = 'AGUARDANDO_HOMOLOGACAO',
  REPROVADO_HOMOLOGACAO = 'REPROVADO_HOMOLOGACAO',
  CONCLUIDO = 'CONCLUIDO',
  CANCELADO = 'CANCELADO',
}

/** Categorias iniciais de ocorrência (seção 5.2). */
export enum OccurrenceCategory {
  ERRO_FUNCIONAL = 'ERRO_FUNCIONAL',
  ERRO_VISUAL = 'ERRO_VISUAL',
  ERRO_INTEGRACAO = 'ERRO_INTEGRACAO',
  ERRO_VALIDACAO = 'ERRO_VALIDACAO',
  DESEMPENHO = 'DESEMPENHO',
  SEGURANCA = 'SEGURANCA',
  ACESSIBILIDADE = 'ACESSIBILIDADE',
  COMPATIBILIDADE = 'COMPATIBILIDADE',
  OUTROS = 'OUTROS',
}

/** Tipos de ambiente por projeto (seção 11). */
export enum EnvironmentType {
  DEVELOPMENT = 'DEVELOPMENT',
  TESTING = 'TESTING',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
}

/** Canais de notificação (seções 7 e 11). */
export enum NotificationChannel {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  TEAMS = 'TEAMS',
}

/** Eventos que disparam notificação (seção 7). */
export enum NotificationEventType {
  OCCURRENCE_CREATED = 'OCCURRENCE_CREATED',
  OCCURRENCE_UPDATED = 'OCCURRENCE_UPDATED',
  OCCURRENCE_STATUS_CHANGED = 'OCCURRENCE_STATUS_CHANGED',
}

/** Status de uma entrega de notificação (seção 11). */
export enum NotificationDeliveryStatus {
  PENDENTE = 'PENDENTE',
  ENVIADO = 'ENVIADO',
  FALHA = 'FALHA',
  DESCARTADO = 'DESCARTADO',
}

/**
 * Tipos de sugestão produzida pelo módulo OPCIONAL de IA (seção 8).
 *
 * A IA é sempre ASSISTIVA: nenhuma sugestão é aplicada automaticamente — toda
 * mudança exige confirmação humana. Não há enum equivalente no schema porque
 * `AIAnalysis.suggestions` é um JSON livre (validado na leitura).
 */
export enum AiSuggestionType {
  RESUMO = 'RESUMO',
  CATEGORIA = 'CATEGORIA',
  PRIORIDADE = 'PRIORIDADE',
  DUPLICIDADE = 'DUPLICIDADE',
}

/** Ações registradas no histórico da ocorrência. */
export enum OccurrenceHistoryAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  PRIORITY_CHANGED = 'PRIORITY_CHANGED',
  ASSIGNEE_CHANGED = 'ASSIGNEE_CHANGED',
  COMMENT_ADDED = 'COMMENT_ADDED',
  ATTACHMENT_ADDED = 'ATTACHMENT_ADDED',
}

/** Listas auxiliares (úteis para selects, validação e seed). */
export const GLOBAL_ROLES: readonly GlobalRole[] = Object.values(GlobalRole);
export const PROJECT_ROLES: readonly ProjectRole[] = Object.values(ProjectRole);
export const OCCURRENCE_PRIORITIES: readonly OccurrencePriority[] = Object.values(OccurrencePriority);
export const OCCURRENCE_STATUSES: readonly OccurrenceStatus[] = Object.values(OccurrenceStatus);
export const OCCURRENCE_CATEGORIES: readonly OccurrenceCategory[] = Object.values(OccurrenceCategory);
export const ENVIRONMENT_TYPES: readonly EnvironmentType[] = Object.values(EnvironmentType);
export const AI_SUGGESTION_TYPES: readonly AiSuggestionType[] = Object.values(AiSuggestionType);
