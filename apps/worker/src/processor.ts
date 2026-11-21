/**
 * Processador de notificações (ETAPA 8).
 *
 * Fluxo (seções 3, 5 e 10 de `notificacoes-whatsapp.md`):
 * 1. valida o payload; 2. carrega a ocorrência (já salva antes da notificação);
 * 3. resolve os destinos pelas regras habilitadas (ou pelo destino explícito do
 * reprocessamento); 4. registra e executa cada entrega com idempotência por
 * evento+destino. Falhas recuperáveis são relançadas para acionar a retentativa
 * com backoff do BullMQ; falhas definitivas usam `UnrecoverableError`.
 */
import {
  NotificationDeliveryStatus,
  type NotificationDestination,
  type NotificationRule,
  type Occurrence,
  type PrismaClient,
  type Project,
  type ProjectEnvironment,
  type User,
} from '@prisma/client';
import { UnrecoverableError, type Job } from 'bullmq';
import { notificationJobPayloadSchema, type NotificationJobPayload } from '@qualitytest/shared';

import type { ChannelRegistry, ChannelSendResult } from './channels';
import type { WorkerLogger } from './config';
import { buildNotificationMessage } from './message';

type OccurrenceContext = Occurrence & {
  project: Pick<Project, 'name' | 'code'>;
  environment: Pick<ProjectEnvironment, 'name'> | null;
  reporter: Pick<User, 'name'>;
};

type RuleWithDestination = NotificationRule & { destination: NotificationDestination };

export interface ProcessorDependencies {
  prisma: PrismaClient;
  channels: ChannelRegistry;
  logger: WorkerLogger;
  webBaseUrl: string | null;
}

/** Extrai uma mensagem de erro segura (sem credenciais). */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** Aplica os filtros opcionais de uma regra (prioridades/categorias). */
function ruleMatches(rule: RuleWithDestination, occurrence: OccurrenceContext): boolean {
  const filters = asRecord(rule.filters);
  if (filters === null) {
    return true;
  }

  const priorities = filters.priorities;
  if (Array.isArray(priorities) && priorities.length > 0 && !priorities.includes(occurrence.priority)) {
    return false;
  }

  const categories = filters.categories;
  if (Array.isArray(categories) && categories.length > 0 && !categories.includes(occurrence.categoryId)) {
    return false;
  }

  return true;
}

/**
 * Resolve os destinos do evento: destino explícito (reprocessamento) ou todos
 * os destinos habilitados por regras habilitadas que casam com a ocorrência.
 */
async function resolveDestinations(
  deps: ProcessorDependencies,
  payload: NotificationJobPayload,
  occurrence: OccurrenceContext,
): Promise<NotificationDestination[]> {
  if (payload.destinationId !== undefined) {
    const destination = await deps.prisma.notificationDestination.findUnique({
      where: { id: payload.destinationId },
    });
    return destination === null ? [] : [destination];
  }

  if (payload.eventType === undefined) {
    return [];
  }

  const rules = await deps.prisma.notificationRule.findMany({
    where: { projectId: payload.projectId, eventType: payload.eventType, enabled: true },
    include: { destination: true },
  });

  const byId = new Map<string, NotificationDestination>();
  for (const rule of rules) {
    if (rule.destination.enabled && ruleMatches(rule, occurrence)) {
      byId.set(rule.destination.id, rule.destination);
    }
  }

  return [...byId.values()];
}

/** Chave de idempotência por evento e destino (seção 10). */
function buildIdempotencyKey(payload: NotificationJobPayload, destinationId: string): string {
  const base =
    payload.idempotencyKey ?? `occurrence:${payload.occurrenceId}:${payload.eventType ?? 'manual'}`;
  return `${base}:dest:${destinationId}`;
}

/** Registra o desfecho de uma tentativa de entrega. */
async function finalizeDelivery(
  prisma: PrismaClient,
  deliveryId: string,
  attempts: number,
  status: NotificationDeliveryStatus,
  result: { providerMessageId?: string | null; lastError: string | null },
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status,
      attempts: attempts + 1,
      lastError: result.lastError,
      ...(result.providerMessageId === undefined ? {} : { providerMessageId: result.providerMessageId }),
    },
  });
}

/** Processa a entrega em um único destino, respeitando a idempotência. */
async function deliverToDestination(
  deps: ProcessorDependencies,
  payload: NotificationJobPayload,
  occurrence: OccurrenceContext,
  destination: NotificationDestination,
): Promise<void> {
  const { prisma, logger } = deps;
  const idempotencyKey = buildIdempotencyKey(payload, destination.id);

  const existing = await prisma.notificationDelivery.findFirst({
    where: { occurrenceId: occurrence.id, destinationId: destination.id, idempotencyKey },
  });

  // Idempotência: desfechos terminais não são reprocessados → sem duplicidade.
  if (
    existing !== null &&
    (existing.status === NotificationDeliveryStatus.ENVIADO ||
      existing.status === NotificationDeliveryStatus.DESCARTADO)
  ) {
    logger.info('Entrega já finalizada; ignorada (idempotência).', {
      deliveryId: existing.id,
      status: existing.status,
    });
    return;
  }

  const delivery =
    existing ??
    (await prisma.notificationDelivery.create({
      data: {
        occurrenceId: occurrence.id,
        destinationId: destination.id,
        idempotencyKey,
        status: NotificationDeliveryStatus.PENDENTE,
      },
    }));

  if (!destination.enabled) {
    await finalizeDelivery(prisma, delivery.id, delivery.attempts, NotificationDeliveryStatus.DESCARTADO, {
      lastError: 'Destino de notificação desabilitado.',
    });
    return;
  }

  const adapter = deps.channels.get(destination.channel);
  if (adapter === undefined) {
    await finalizeDelivery(prisma, delivery.id, delivery.attempts, NotificationDeliveryStatus.DESCARTADO, {
      lastError: `Canal de notificação não suportado: ${destination.channel}.`,
    });
    return;
  }

  const message = buildNotificationMessage(
    {
      occurrence,
      project: occurrence.project,
      environment: occurrence.environment,
      reporter: occurrence.reporter,
    },
    payload.eventType,
    deps.webBaseUrl,
  );

  let result: ChannelSendResult;
  try {
    result = await adapter.send({ destination, message });
  } catch (error: unknown) {
    result = { outcome: 'failed', error: describeError(error) };
  }

  if (result.outcome === 'sent') {
    await finalizeDelivery(prisma, delivery.id, delivery.attempts, NotificationDeliveryStatus.ENVIADO, {
      providerMessageId: result.providerMessageId,
      lastError: null,
    });
    return;
  }

  if (result.outcome === 'discarded') {
    await finalizeDelivery(prisma, delivery.id, delivery.attempts, NotificationDeliveryStatus.DESCARTADO, {
      lastError: result.reason,
    });
    return;
  }

  // Falha recuperável: registra FALHA e relança para acionar a retentativa.
  await finalizeDelivery(prisma, delivery.id, delivery.attempts, NotificationDeliveryStatus.FALHA, {
    lastError: result.error,
  });
  throw new Error(`Falha ao enviar notificação (${destination.channel}): ${result.error}`);
}

/**
 * Cria o processador de jobs consumido pelo `Worker` do BullMQ.
 */
export function createNotificationProcessor(
  deps: ProcessorDependencies,
): (job: Job<NotificationJobPayload>) => Promise<void> {
  return async (job: Job<NotificationJobPayload>): Promise<void> => {
    const parsed = notificationJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw new UnrecoverableError(`Payload de notificação inválido: ${details}`);
    }

    const payload: NotificationJobPayload = parsed.data;

    const occurrence = await deps.prisma.occurrence.findUnique({
      where: { id: payload.occurrenceId },
      include: {
        project: { select: { name: true, code: true } },
        environment: { select: { name: true } },
        reporter: { select: { name: true } },
      },
    });

    if (occurrence === null) {
      throw new UnrecoverableError(`Ocorrência não encontrada: ${payload.occurrenceId}.`);
    }

    const destinations = await resolveDestinations(deps, payload, occurrence);
    if (destinations.length === 0) {
      deps.logger.info('Nenhum destino aplicável; nada a notificar.', {
        occurrenceId: occurrence.id,
        eventType: payload.eventType ?? 'manual',
      });
      return;
    }

    for (const destination of destinations) {
      await deliverToDestination(deps, payload, occurrence, destination);
    }
  };
}
