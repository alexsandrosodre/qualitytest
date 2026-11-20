/**
 * Worker BullMQ do QUALITY TEST - ESQUELETO (Etapa 2).
 *
 * Nesta etapa existe somente a infraestrutura da fila `notifications` e um
 * processor que apenas registra o recebimento do job em log. NÃO há lógica de
 * negócio nem integração com WhatsApp (previsto para a Etapa 8).
 */
import path from 'node:path';

import { Job, Queue, Worker } from 'bullmq';

// Carrega o `.env` da raiz do monorepo quando existir (node >= 20.12).
// O arquivo é opcional: em ambientes de execução as variáveis vêm do próprio ambiente.
try {
  process.loadEnvFile(path.resolve(__dirname, '../../../.env'));
} catch {
  // Sem `.env` na raiz: segue com as variáveis já presentes no ambiente.
}

export const NOTIFICATIONS_QUEUE = 'notifications';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  db: number;
  password?: string;
}

export interface NotificationJobData {
  eventType: string;
  occurrenceId: string;
  projectId: string;
  destinationId?: string;
  idempotencyKey?: string;
  [key: string]: unknown;
}

export function readRedisConnection(): RedisConnectionOptions {
  const rawPort = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);
  const rawDb = Number.parseInt(process.env.REDIS_DB ?? '0', 10);
  const password = process.env.REDIS_PASSWORD;

  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number.isNaN(rawPort) ? 6379 : rawPort,
    db: Number.isNaN(rawDb) ? 0 : rawDb,
    ...(password !== undefined && password.length > 0 ? { password } : {}),
  };
}

export function createNotificationsQueue(
  connection: RedisConnectionOptions,
): Queue<NotificationJobData> {
  return new Queue<NotificationJobData>(NOTIFICATIONS_QUEUE, { connection });
}

/**
 * Processor placeholder. Não implementa nenhuma regra de negócio.
 */
async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  console.log(
    `[worker] job recebido: id=${job.id ?? 'sem-id'} nome=${job.name} evento=${job.data.eventType} ` +
      `ocorrencia=${job.data.occurrenceId}`,
  );
}

async function main(): Promise<void> {
  const connection = readRedisConnection();
  const queue = createNotificationsQueue(connection);

  const worker = new Worker<NotificationJobData>(NOTIFICATIONS_QUEUE, processNotification, {
    connection,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    console.log(`[worker] job concluído: ${job.id ?? 'sem-id'}`);
  });

  worker.on('failed', (job, error) => {
    // Erros são registrados sem expor credenciais ou tokens.
    console.error(`[worker] job falhou: ${job?.id ?? 'sem-id'} - ${error.message}`);
  });

  worker.on('error', (error) => {
    console.error(`[worker] erro na fila ${NOTIFICATIONS_QUEUE}: ${error.message}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] encerrando (${signal})...`);
    await worker.close();
    await queue.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  console.log(
    `[worker] aguardando jobs na fila "${NOTIFICATIONS_QUEUE}" ` +
      `(${connection.host}:${connection.port}/db${connection.db})`,
  );
}

main().catch((error: unknown) => {
  console.error(`[worker] falha ao iniciar: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
