/**
 * Worker de notificações do QUALITY TEST (ETAPA 8).
 *
 * Consome a fila `notifications` (BullMQ/Redis), mantendo a notificação
 * desacoplada do núcleo: a ocorrência é salva pela API antes de qualquer envio e
 * a indisponibilidade do canal jamais desfaz o registro (seções 5 e 8 de
 * `notificacoes-whatsapp.md`).
 *
 * - Retentativas com backoff: configuradas na publicação (`NOTIFICATION_JOB_OPTIONS`).
 * - Dead-letter queue: jobs que esgotam as tentativas são copiados para
 *   `notifications-dlq`, de onde podem ser inspecionados e reprocessados
 *   administrativamente.
 * - Canal WhatsApp: OFICIAL (Cloud API). Permanece DESATIVADO enquanto não
 *   houver credenciais no ambiente (seção 7.1) — ver `readWhatsAppConfig()`.
 */
import { PrismaClient } from '@prisma/client';
import { Queue, Worker, type Job } from 'bullmq';

import { createChannelRegistry } from './channels';
import {
  NOTIFICATIONS_DLQ,
  NOTIFICATIONS_QUEUE,
  readWhatsAppConfig,
  readWorkerConfig,
  type RedisConnectionOptions,
  type WorkerLogger,
} from './config';
import { createNotificationProcessor } from './processor';
import type { NotificationJobPayload } from '@qualitytest/shared';

export { NOTIFICATIONS_DLQ, NOTIFICATIONS_QUEUE, readRedisConnection } from './config';

/** Payload da DLQ: o evento original acrescido do motivo da falha. */
export interface DeadLetterPayload extends NotificationJobPayload {
  failedReason?: string;
  attemptsMade?: number;
}

/** Logger mínimo em console (sem expor credenciais). */
const logger: WorkerLogger = {
  info: (message, meta) => {
    console.log(`[worker] ${message}${meta === undefined ? '' : ` ${JSON.stringify(meta)}`}`);
  },
  warn: (message, meta) => {
    console.warn(`[worker] ${message}${meta === undefined ? '' : ` ${JSON.stringify(meta)}`}`);
  },
  error: (message, meta) => {
    console.error(`[worker] ${message}${meta === undefined ? '' : ` ${JSON.stringify(meta)}`}`);
  },
};

/** Cria a fila principal de notificações (usada para inspeção/reprocesso). */
export function createNotificationsQueue(
  connection: RedisConnectionOptions,
): Queue<NotificationJobPayload> {
  return new Queue<NotificationJobPayload>(NOTIFICATIONS_QUEUE, { connection });
}

async function main(): Promise<void> {
  const config = readWorkerConfig();
  const prisma = new PrismaClient();
  await prisma.$connect();

  const queue = createNotificationsQueue(config.connection);
  const deadLetterQueue = new Queue<DeadLetterPayload>(NOTIFICATIONS_DLQ, {
    connection: config.connection,
  });

  // Sem listeners, indisponibilidade do Redis vira erro não tratado.
  queue.on('error', (error: Error) => logger.warn(`Erro na fila "${NOTIFICATIONS_QUEUE}": ${error.message}`));
  deadLetterQueue.on('error', (error: Error) =>
    logger.warn(`Erro na fila "${NOTIFICATIONS_DLQ}": ${error.message}`),
  );

  const whatsapp = readWhatsAppConfig();
  if (whatsapp === null) {
    logger.warn(
      'Canal WhatsApp desativado: credenciais oficiais (WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_CLOUD_API_TOKEN) ausentes.',
    );
  } else {
    logger.info(`Canal WhatsApp oficial ativo (Graph ${whatsapp.apiVersion}).`);
  }

  const processor = createNotificationProcessor({
    prisma,
    channels: createChannelRegistry(whatsapp),
    logger,
    webBaseUrl: config.webBaseUrl,
  });

  const worker = new Worker<NotificationJobPayload>(NOTIFICATIONS_QUEUE, processor, {
    connection: config.connection,
    concurrency: config.concurrency,
  });

  worker.on('completed', (job: Job<NotificationJobPayload>) => {
    logger.info('Job concluído.', { id: job.id ?? 'sem-id' });
  });

  worker.on('failed', (job: Job<NotificationJobPayload> | undefined, error: Error) => {
    logger.error(`Job falhou: ${job?.id ?? 'sem-id'}.`, { motivo: error.message });

    // Dead-letter queue: copia o job apenas quando as tentativas se esgotarem.
    if (job === undefined) {
      return;
    }
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    void deadLetterQueue
      .add(
        job.name,
        {
          ...job.data,
          failedReason: error.message,
          attemptsMade: job.attemptsMade,
        },
        { removeOnComplete: false, removeOnFail: false },
      )
      .catch((dlqError: unknown) => {
        logger.warn('Falha ao registrar job na DLQ.', {
          motivo: dlqError instanceof Error ? dlqError.message : String(dlqError),
        });
      });
  });

  worker.on('error', (error: Error) => logger.error(`Erro na fila "${NOTIFICATIONS_QUEUE}": ${error.message}`));

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Encerrando (${signal})...`);
    await worker.close();
    await deadLetterQueue.close();
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logger.info(
    `Aguardando jobs na fila "${NOTIFICATIONS_QUEUE}" ` +
      `(${config.connection.host}:${config.connection.port}/db${config.connection.db}), ` +
      `concorrência=${config.concurrency}.`,
  );
}

main().catch((error: unknown) => {
  logger.error(`Falha ao iniciar o worker: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
