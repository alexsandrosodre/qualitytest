/**
 * Formatadores e rótulos em português para os enums de domínio do QUALITY TEST.
 */
import {
  EnvironmentType,
  GlobalRole,
  OccurrenceCategory,
  OccurrenceHistoryAction,
  OccurrencePriority,
  OccurrenceStatus,
  ProjectRole,
  RegistrationStatus,
} from '@qualitytest/shared';

/** Concatena classes condicionalmente (evita dependências extras). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ');
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Data/hora completa em pt-BR ou `—` quando ausente/ inválida. */
export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return dateTimeFormatter.format(date);
}

/** Data (sem hora) em pt-BR. */
export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return dateFormatter.format(date);
}

/** Tamanho de arquivo legível. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export const GLOBAL_ROLE_LABELS: Record<GlobalRole, string> = {
  [GlobalRole.ADMINISTRADOR]: 'Administrador',
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  [ProjectRole.GESTOR]: 'Gestor',
  [ProjectRole.TESTADOR]: 'Testador',
  [ProjectRole.DESENVOLVEDOR]: 'Desenvolvedor',
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  [RegistrationStatus.ATIVO]: 'Ativo',
  [RegistrationStatus.INATIVO]: 'Inativo',
};

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  [OccurrenceStatus.ABERTO]: 'Aberto',
  [OccurrenceStatus.EM_ANALISE]: 'Em análise',
  [OccurrenceStatus.EM_DESENVOLVIMENTO]: 'Em desenvolvimento',
  [OccurrenceStatus.AGUARDANDO_HOMOLOGACAO]: 'Aguardando homologação',
  [OccurrenceStatus.REPROVADO_HOMOLOGACAO]: 'Reprovado na homologação',
  [OccurrenceStatus.CONCLUIDO]: 'Concluído',
  [OccurrenceStatus.CANCELADO]: 'Cancelado',
};

export const OCCURRENCE_PRIORITY_LABELS: Record<OccurrencePriority, string> = {
  [OccurrencePriority.CRITICA]: 'Crítica',
  [OccurrencePriority.ALTA]: 'Alta',
  [OccurrencePriority.MEDIA]: 'Média',
  [OccurrencePriority.BAIXA]: 'Baixa',
};

export const OCCURRENCE_CATEGORY_LABELS: Record<OccurrenceCategory, string> = {
  [OccurrenceCategory.ERRO_FUNCIONAL]: 'Erro funcional',
  [OccurrenceCategory.ERRO_VISUAL]: 'Erro visual',
  [OccurrenceCategory.ERRO_INTEGRACAO]: 'Erro de integração',
  [OccurrenceCategory.ERRO_VALIDACAO]: 'Erro de validação',
  [OccurrenceCategory.DESEMPENHO]: 'Desempenho',
  [OccurrenceCategory.SEGURANCA]: 'Segurança',
  [OccurrenceCategory.ACESSIBILIDADE]: 'Acessibilidade',
  [OccurrenceCategory.COMPATIBILIDADE]: 'Compatibilidade',
  [OccurrenceCategory.OUTROS]: 'Outros',
};

export const ENVIRONMENT_TYPE_LABELS: Record<EnvironmentType, string> = {
  [EnvironmentType.DEVELOPMENT]: 'Desenvolvimento',
  [EnvironmentType.TESTING]: 'Teste',
  [EnvironmentType.STAGING]: 'Homologação',
  [EnvironmentType.PRODUCTION]: 'Produção',
};

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  [OccurrenceHistoryAction.CREATED]: 'Criação',
  [OccurrenceHistoryAction.UPDATED]: 'Atualização',
  [OccurrenceHistoryAction.STATUS_CHANGED]: 'Mudança de status',
  [OccurrenceHistoryAction.PRIORITY_CHANGED]: 'Mudança de prioridade',
  [OccurrenceHistoryAction.ASSIGNEE_CHANGED]: 'Mudança de responsável',
  [OccurrenceHistoryAction.COMMENT_ADDED]: 'Comentário adicionado',
  [OccurrenceHistoryAction.ATTACHMENT_ADDED]: 'Anexo adicionado',
};

export function historyActionLabel(action: string): string {
  return HISTORY_ACTION_LABELS[action] ?? action;
}
