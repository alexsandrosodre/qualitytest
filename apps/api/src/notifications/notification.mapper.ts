import type {
  NotificationDelivery,
  NotificationDestination,
  NotificationRule,
} from '@prisma/client';

/**
 * Views da API de notificações. Seguem o padrão do repositório (como
 * `occurrence.mapper.ts`/`project.mapper.ts`): os tipos de enum vêm do Prisma
 * (fonte do schema), evitando conflito nominal com os enums de domínio do
 * pacote compartilhado (consumidos pelo frontend).
 */

/** Visão pública do destino. Nunca expõe segredos em `destinationConfig`. */
export interface NotificationDestinationView {
  id: string;
  projectId: string;
  channel: NotificationDestination['channel'];
  destinationConfig: Record<string, unknown>;
  enabled: boolean;
}

/** Visão de uma regra de notificação. */
export interface NotificationRuleView {
  id: string;
  projectId: string;
  eventType: NotificationRule['eventType'];
  filters: Record<string, unknown> | null;
  destinationId: string;
  enabled: boolean;
}

/** Visão de uma tentativa de entrega registrada. */
export interface NotificationDeliveryView {
  id: string;
  occurrenceId: string;
  destinationId: string;
  idempotencyKey: string;
  status: NotificationDelivery['status'];
  providerMessageId: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * `destinationConfig` nunca expõe segredos: a escrita aceita apenas as chaves
 * da lista permitida por canal (`validateChannelConfig`).
 */
export function toNotificationDestinationView(
  destination: NotificationDestination,
): NotificationDestinationView {
  return {
    id: destination.id,
    projectId: destination.projectId,
    channel: destination.channel,
    destinationConfig: asRecord(destination.destinationConfig) ?? {},
    enabled: destination.enabled,
  };
}

export function toNotificationRuleView(rule: NotificationRule): NotificationRuleView {
  return {
    id: rule.id,
    projectId: rule.projectId,
    eventType: rule.eventType,
    filters: asRecord(rule.filters),
    destinationId: rule.destinationId,
    enabled: rule.enabled,
  };
}

export function toNotificationDeliveryView(delivery: NotificationDelivery): NotificationDeliveryView {
  return {
    id: delivery.id,
    occurrenceId: delivery.occurrenceId,
    destinationId: delivery.destinationId,
    idempotencyKey: delivery.idempotencyKey,
    status: delivery.status,
    providerMessageId: delivery.providerMessageId,
    attempts: delivery.attempts,
    lastError: delivery.lastError,
    createdAt: delivery.createdAt.toISOString(),
    updatedAt: delivery.updatedAt.toISOString(),
  };
}
