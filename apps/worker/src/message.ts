/**
 * Montagem da mensagem padronizada de notificação (seção 4 de
 * `notificacoes-whatsapp.md`).
 *
 * Nunca inclui tokens, cookies ou segredos: apenas dados do domínio e, quando
 * configurado, um link para a área autenticada do frontend.
 */
import type {
  Occurrence,
  OccurrenceCategory,
  OccurrencePriority,
  Project,
  ProjectEnvironment,
  User,
} from '@prisma/client';
import { NotificationEventType } from '@qualitytest/shared';

import type { DeliveryMessage } from './channels';

export interface NotificationMessageContext {
  occurrence: Occurrence;
  project: Pick<Project, 'name' | 'code'> | null;
  environment: Pick<ProjectEnvironment, 'name'> | null;
  reporter: Pick<User, 'name'> | null;
}

/** Rótulos em português (o worker não importa utilitários do frontend). */
const CATEGORY_LABELS: Record<OccurrenceCategory, string> = {
  ERRO_FUNCIONAL: 'Erro funcional',
  ERRO_VISUAL: 'Erro visual',
  ERRO_INTEGRACAO: 'Erro de integração',
  ERRO_VALIDACAO: 'Erro de validação',
  DESEMPENHO: 'Desempenho',
  SEGURANCA: 'Segurança',
  ACESSIBILIDADE: 'Acessibilidade',
  COMPATIBILIDADE: 'Compatibilidade',
  OUTROS: 'Outros',
};

const PRIORITY_LABELS: Record<OccurrencePriority, string> = {
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
};

const HEADERS: Record<NotificationEventType, string> = {
  [NotificationEventType.OCCURRENCE_CREATED]: 'QUALITY TEST — NOVA OCORRÊNCIA',
  [NotificationEventType.OCCURRENCE_UPDATED]: 'QUALITY TEST — OCORRÊNCIA ATUALIZADA',
  [NotificationEventType.OCCURRENCE_STATUS_CHANGED]: 'QUALITY TEST — OCORRÊNCIA ATUALIZADA',
};

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Monta a mensagem padronizada. `eventType` ausente corresponde ao
 * reprocessamento administrativo (cabeçalho genérico).
 */
export function buildNotificationMessage(
  context: NotificationMessageContext,
  eventType: NotificationEventType | undefined,
  webBaseUrl: string | null,
): DeliveryMessage {
  const { occurrence } = context;
  const header = eventType === undefined ? 'QUALITY TEST — OCORRÊNCIA' : HEADERS[eventType];

  const lines: Array<string | null> = [
    `Código: ${occurrence.publicCode}`,
    context.project === null ? null : `Projeto: ${context.project.name}`,
    `Categoria: ${CATEGORY_LABELS[occurrence.categoryId]}`,
    `Prioridade: ${PRIORITY_LABELS[occurrence.priority]}`,
    `Título: ${occurrence.title}`,
    context.reporter === null ? null : `Registrado por: ${context.reporter.name}`,
    context.environment === null ? null : `Ambiente: ${context.environment.name}`,
    `Data: ${dateTimeFormatter.format(occurrence.createdAt)}`,
    webBaseUrl === null ? null : `Acesse: ${webBaseUrl}/occurrences/${occurrence.id}`,
  ];

  const body = [header, ...lines.filter((line): line is string => line !== null)].join('\n');

  return { subject: header, body };
}
