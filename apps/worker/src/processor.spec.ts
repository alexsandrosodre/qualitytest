/**
 * Testes unitários do processador de notificações (ETAPA 8).
 *
 * Cobrem os critérios de aceite: notificação não bloqueia o núcleo (já salvo),
 * falha não perde o registro, retentativa não duplica (idempotência) e o canal
 * pode permanecer desativado sem credenciais.
 */
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType as PrismaNotificationEventType,
  OccurrenceCategory,
  OccurrencePriority,
  OccurrenceStatus,
  type NotificationDelivery,
  type NotificationDestination,
  type NotificationRule,
  type Occurrence,
  type PrismaClient,
} from '@prisma/client';
import { UnrecoverableError, type Job } from 'bullmq';
import {
  NotificationEventType,
  type NotificationJobPayload,
} from '@qualitytest/shared';

import {
  createChannelRegistry,
  type ChannelRegistry,
  type NotificationChannelAdapter,
} from './channels';
import type { WorkerLogger } from './config';
import { createNotificationProcessor } from './processor';

const silentLogger: WorkerLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

interface Store {
  occurrence: (Occurrence & {
    project: { name: string; code: string };
    environment: { name: string } | null;
    reporter: { name: string };
  }) | null;
  destinations: NotificationDestination[];
  rules: Array<NotificationRule & { destination: NotificationDestination }>;
  deliveries: NotificationDelivery[];
}

function createOccurrence(projectId: string): Store['occurrence'] {
  return {
    id: 'occ-1',
    publicCode: 'QT-000001',
    idempotencyKey: null,
    projectId,
    environmentId: null,
    title: 'Componente desalinhado',
    description: null,
    categoryId: OccurrenceCategory.ERRO_VISUAL,
    priority: OccurrencePriority.ALTA,
    status: OccurrenceStatus.ABERTO,
    reporterUserId: 'user-1',
    assigneeUserId: null,
    pageUrl: null,
    pageTitle: null,
    browserInfo: null,
    operatingSystemInfo: null,
    viewportInfo: null,
    createdAt: new Date('2026-11-21T10:00:00.000Z'),
    updatedAt: new Date('2026-11-21T10:00:00.000Z'),
    project: { name: 'Intranet Maricá', code: 'INTRA' },
    environment: { name: 'Homologação' },
    reporter: { name: 'Maria' },
  };
}

function createDestination(id: string, projectId: string, enabled: boolean): NotificationDestination {
  return {
    id,
    projectId,
    channel: NotificationChannel.WHATSAPP,
    destinationConfig: { recipientRef: 'grupo-homologacao' },
    enabled,
  };
}

/** Regra habilitada para OCCURRENCE_CREATED apontando para o destino informado. */
function ruleFor(
  destination: NotificationDestination,
): NotificationRule & { destination: NotificationDestination } {
  return {
    id: `rule-${destination.id}`,
    projectId: destination.projectId,
    eventType: PrismaNotificationEventType.OCCURRENCE_CREATED,
    filters: null,
    destinationId: destination.id,
    enabled: true,
    destination,
  };
}

function createPrismaStub(store: Store): PrismaClient {
  const stub = {
    occurrence: {
      findUnique: async (args: { where: { id: string } }) =>
        store.occurrence !== null && store.occurrence.id === args.where.id ? store.occurrence : null,
    },
    notificationDestination: {
      findUnique: async (args: { where: { id: string } }) =>
        store.destinations.find((destination) => destination.id === args.where.id) ?? null,
    },
    notificationRule: {
      findMany: async (args: {
        where: { projectId: string; eventType: PrismaNotificationEventType; enabled: boolean };
      }) =>
        store.rules.filter(
          (rule) =>
            rule.projectId === args.where.projectId &&
            rule.eventType === args.where.eventType &&
            rule.enabled === args.where.enabled,
        ),
    },
    notificationDelivery: {
      findFirst: async (args: {
        where: { occurrenceId: string; destinationId: string; idempotencyKey: string };
      }) =>
        store.deliveries.find(
          (delivery) =>
            delivery.occurrenceId === args.where.occurrenceId &&
            delivery.destinationId === args.where.destinationId &&
            delivery.idempotencyKey === args.where.idempotencyKey,
        ) ?? null,
      create: async (args: { data: Pick<NotificationDelivery, 'occurrenceId' | 'destinationId' | 'idempotencyKey' | 'status'> }) => {
        const delivery: NotificationDelivery = {
          id: `del-${store.deliveries.length + 1}`,
          occurrenceId: args.data.occurrenceId,
          destinationId: args.data.destinationId,
          idempotencyKey: args.data.idempotencyKey,
          status: args.data.status,
          providerMessageId: null,
          attempts: 0,
          lastError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.deliveries.push(delivery);
        return delivery;
      },
      update: async (args: { where: { id: string }; data: Partial<NotificationDelivery> }) => {
        const index = store.deliveries.findIndex((delivery) => delivery.id === args.where.id);
        const current = store.deliveries[index];
        if (current === undefined) {
          throw new Error(`Entrega não encontrada: ${args.where.id}`);
        }
        const updated: NotificationDelivery = { ...current, ...args.data, updatedAt: new Date() };
        store.deliveries[index] = updated;
        return updated;
      },
    },
  };

  return stub as unknown as PrismaClient;
}

function createJob(payload: NotificationJobPayload): Job<NotificationJobPayload> {
  return { data: payload } as Job<NotificationJobPayload>;
}

function createRegistryWith(adapter: NotificationChannelAdapter): ChannelRegistry {
  return new Map([[adapter.channel, adapter]]);
}

const createdPayload: NotificationJobPayload = {
  eventType: NotificationEventType.OCCURRENCE_CREATED,
  occurrenceId: 'occ-1',
  projectId: 'proj-1',
  idempotencyKey: 'occurrence-created:occ-1',
};

describe('createNotificationProcessor (worker)', () => {
  function setup(store: Store, channels: ChannelRegistry) {
    return createNotificationProcessor({
      prisma: createPrismaStub(store),
      channels,
      logger: silentLogger,
      webBaseUrl: 'https://qualitytest.local',
    });
  }

  it('registra entrega ENVIADO quando o canal tem sucesso', async () => {
    const destination = createDestination('dest-1', 'proj-1', true);
    const store: Store = {
      occurrence: createOccurrence('proj-1'),
      destinations: [destination],
      rules: [ruleFor(destination)],
      deliveries: [],
    };
    const adapter: NotificationChannelAdapter = {
      channel: NotificationChannel.WHATSAPP,
      send: async () => ({ outcome: 'sent', providerMessageId: 'wamid.123' }),
    };

    await setup(store, createRegistryWith(adapter))(createJob(createdPayload));

    expect(store.deliveries).toHaveLength(1);
    expect(store.deliveries[0]?.status).toBe(NotificationDeliveryStatus.ENVIADO);
    expect(store.deliveries[0]?.providerMessageId).toBe('wamid.123');
    expect(store.deliveries[0]?.attempts).toBe(1);
  });

  it('descarta a entrega quando o canal WhatsApp está desativado (sem credenciais)', async () => {
    const destination = createDestination('dest-1', 'proj-1', true);
    const store: Store = {
      occurrence: createOccurrence('proj-1'),
      destinations: [destination],
      rules: [ruleFor(destination)],
      deliveries: [],
    };

    await setup(store, createChannelRegistry())(createJob(createdPayload));

    expect(store.deliveries).toHaveLength(1);
    expect(store.deliveries[0]?.status).toBe(NotificationDeliveryStatus.DESCARTADO);
    expect(store.deliveries[0]?.lastError).toContain('desativado');
  });

  it('não duplica: entrega já ENVIADO é ignorada em reprocessamento do mesmo evento', async () => {
    const destination = createDestination('dest-1', 'proj-1', true);
    const store: Store = {
      occurrence: createOccurrence('proj-1'),
      destinations: [destination],
      rules: [ruleFor(destination)],
      deliveries: [
        {
          id: 'del-1',
          occurrenceId: 'occ-1',
          destinationId: 'dest-1',
          idempotencyKey: 'occurrence-created:occ-1:dest:dest-1',
          status: NotificationDeliveryStatus.ENVIADO,
          providerMessageId: 'wamid.123',
          attempts: 1,
          lastError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    let sendCalls = 0;
    const adapter: NotificationChannelAdapter = {
      channel: NotificationChannel.WHATSAPP,
      send: async () => {
        sendCalls += 1;
        return { outcome: 'sent', providerMessageId: 'wamid.999' };
      },
    };

    await setup(store, createRegistryWith(adapter))(createJob(createdPayload));

    expect(sendCalls).toBe(0);
    expect(store.deliveries).toHaveLength(1);
    expect(store.deliveries[0]?.providerMessageId).toBe('wamid.123');
  });

  it('registra FALHA e relança o erro para acionar a retentativa com backoff', async () => {
    const destination = createDestination('dest-1', 'proj-1', true);
    const store: Store = {
      occurrence: createOccurrence('proj-1'),
      destinations: [destination],
      rules: [ruleFor(destination)],
      deliveries: [],
    };
    const adapter: NotificationChannelAdapter = {
      channel: NotificationChannel.WHATSAPP,
      send: async () => ({ outcome: 'failed', error: 'timeout do provedor' }),
    };

    await expect(
      setup(store, createRegistryWith(adapter))(createJob(createdPayload)),
    ).rejects.toThrow('timeout do provedor');

    expect(store.deliveries).toHaveLength(1);
    expect(store.deliveries[0]?.status).toBe(NotificationDeliveryStatus.FALHA);
    expect(store.deliveries[0]?.attempts).toBe(1);

    // A retentativa reaproveita a mesma entrega (mesma chave) e incrementa tentativas.
    await expect(
      setup(store, createRegistryWith(adapter))(createJob(createdPayload)),
    ).rejects.toThrow('timeout do provedor');
    expect(store.deliveries).toHaveLength(1);
    expect(store.deliveries[0]?.attempts).toBe(2);
  });

  it('resolve o destino pelas regras habilitadas do projeto', async () => {
    const destination = createDestination('dest-1', 'proj-1', true);
    const store: Store = {
      occurrence: createOccurrence('proj-1'),
      destinations: [destination],
      rules: [
        {
          id: 'rule-1',
          projectId: 'proj-1',
          eventType: PrismaNotificationEventType.OCCURRENCE_CREATED,
          filters: null,
          destinationId: 'dest-1',
          enabled: true,
          destination,
        },
      ],
      deliveries: [],
    };
    const adapter: NotificationChannelAdapter = {
      channel: NotificationChannel.WHATSAPP,
      send: async () => ({ outcome: 'sent', providerMessageId: 'wamid.rule' }),
    };

    await setup(store, createRegistryWith(adapter))(createJob(createdPayload));

    expect(store.deliveries).toHaveLength(1);
    expect(store.deliveries[0]?.status).toBe(NotificationDeliveryStatus.ENVIADO);
  });

  it('ignora regra cujo filtro de prioridade não casa com a ocorrência', async () => {
    const destination = createDestination('dest-1', 'proj-1', true);
    const store: Store = {
      occurrence: createOccurrence('proj-1'),
      destinations: [destination],
      rules: [
        {
          id: 'rule-1',
          projectId: 'proj-1',
          eventType: PrismaNotificationEventType.OCCURRENCE_CREATED,
          filters: { priorities: [OccurrencePriority.BAIXA] },
          destinationId: 'dest-1',
          enabled: true,
          destination,
        },
      ],
      deliveries: [],
    };
    const adapter: NotificationChannelAdapter = {
      channel: NotificationChannel.WHATSAPP,
      send: async () => ({ outcome: 'sent', providerMessageId: 'x' }),
    };

    await setup(store, createRegistryWith(adapter))(createJob(createdPayload));

    expect(store.deliveries).toHaveLength(0);
  });

  it('rejeita payload inválido como falha definitiva (sem retentativa)', async () => {
    const store: Store = {
      occurrence: createOccurrence('proj-1'),
      destinations: [createDestination('dest-1', 'proj-1', true)],
      rules: [],
      deliveries: [],
    };
    const processor = setup(store, createChannelRegistry());

    await expect(
      processor(createJob({ occurrenceId: '', projectId: 'proj-1' } as NotificationJobPayload)),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('rejeita como falha definitiva quando a ocorrência não existe', async () => {
    const store: Store = {
      occurrence: null,
      destinations: [],
      rules: [],
      deliveries: [],
    };
    const processor = setup(store, createChannelRegistry());

    await expect(processor(createJob(createdPayload))).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('marca DESCARTADO quando o destino está desabilitado', async () => {
    const store: Store = {
      occurrence: createOccurrence('proj-1'),
      destinations: [createDestination('dest-1', 'proj-1', false)],
      rules: [],
      deliveries: [],
    };
    const adapter: NotificationChannelAdapter = {
      channel: NotificationChannel.WHATSAPP,
      send: async () => ({ outcome: 'sent', providerMessageId: 'x' }),
    };
    const payload: NotificationJobPayload = {
      occurrenceId: 'occ-1',
      projectId: 'proj-1',
      destinationId: 'dest-1',
      idempotencyKey: 'manual:dest-1',
    };

    await setup(store, createRegistryWith(adapter))(createJob(payload));

    expect(store.deliveries).toHaveLength(1);
    expect(store.deliveries[0]?.status).toBe(NotificationDeliveryStatus.DESCARTADO);
  });
});
