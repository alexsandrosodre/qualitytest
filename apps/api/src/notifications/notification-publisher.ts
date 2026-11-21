import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { ConnectionOptions, JobsOptions } from 'bullmq';
import { Queue } from 'bullmq';
import type { NotificationJobPayload } from '@qualitytest/shared';

/** Nome da fila de notificações (compartilhado com o worker). */
export const NOTIFICATIONS_QUEUE = 'notifications';

/** Token de injeção do publicador de eventos de notificação. */
export const NOTIFICATION_PUBLISHER = 'NOTIFICATION_PUBLISHER';

/**
 * Abstração de publicação de eventos de notificação (seção 7.2).
 *
 * Existe para que o núcleo (ex.: `OccurrencesService`) nunca dependa diretamente
 * do BullMQ/Redis: a publicação é assíncrona e uma falha de infraestrutura não
 * pode desfazer nem bloquear a operação de negócio.
 */
export interface NotificationPublisher {
  publish(payload: NotificationJobPayload): Promise<void>;
}

/** Opções padrão dos jobs: retentativas com backoff e retenção de histórico. */
export const NOTIFICATION_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: 500,
  removeOnFail: false,
};

/**
 * Publicador real: enfileira o evento na fila BullMQ `notifications`.
 */
export class BullMqNotificationPublisher implements NotificationPublisher, OnModuleDestroy {
  private readonly logger = new Logger(BullMqNotificationPublisher.name);
  private readonly queue: Queue<NotificationJobPayload>;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue<NotificationJobPayload>(NOTIFICATIONS_QUEUE, { connection });

    // Sem este listener, uma indisponibilidade do Redis vira erro não tratado.
    this.queue.on('error', (error: Error) => {
      this.logger.warn(`Falha de comunicação com a fila "${NOTIFICATIONS_QUEUE}": ${error.message}`);
    });
  }

  async publish(payload: NotificationJobPayload): Promise<void> {
    await this.queue.add(payload.eventType ?? 'notification', payload, NOTIFICATION_JOB_OPTIONS);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

/**
 * Publicador no-op: usado quando as notificações estão desabilitadas
 * (`NOTIFICATIONS_ENABLED=false`) ou em execução sem Redis.
 */
export class NoopNotificationPublisher implements NotificationPublisher {
  private readonly logger = new Logger(NoopNotificationPublisher.name);

  async publish(payload: NotificationJobPayload): Promise<void> {
    this.logger.debug(
      `Notificações desabilitadas: evento ignorado (${payload.eventType ?? 'manual'}, ` +
        `ocorrência=${payload.occurrenceId}).`,
    );
  }
}
