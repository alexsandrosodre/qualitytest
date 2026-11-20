import { OUTBOX_STORAGE_KEY, OUTBOX_TTL_MS } from './config';
import type { CreateOccurrencePayload, OutboxAttachment, OutboxJob } from './types';

/** Entrada para enfileirar um job. */
export interface OutboxJobInput {
  payload: CreateOccurrencePayload;
  /**
   * Chave de idempotência já gerada pelo chamador. Quando omitida, é gerada aqui
   * UMA única vez. Em ambos os casos, a mesma chave é reaproveitada em todos os
   * reenvios do job (evita ocorrências duplicadas).
   */
  idempotencyKey?: string;
  attachment?: OutboxAttachment;
}

/**
 * Fila local temporária (outbox) para falhas de conexão, persistida em
 * `chrome.storage.local`. Jobs expiram após `OUTBOX_TTL_MS` (24h).
 */
export async function enqueueJob(input: OutboxJobInput): Promise<OutboxJob> {
  const now = Date.now();
  const job: OutboxJob = {
    id: crypto.randomUUID(),
    idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
    status: 'pendente',
    createdAt: now,
    expiresAt: now + OUTBOX_TTL_MS,
    payload: input.payload,
    ...(input.attachment ? { attachment: input.attachment } : {}),
  };

  const jobs = await readJobs();
  jobs.push(job);
  await writeJobs(jobs);
  return job;
}

/** Lista os jobs pendentes válidos, descartando os expirados. */
export async function listPendingJobs(): Promise<OutboxJob[]> {
  const now = Date.now();
  const jobs = await readJobs();
  const valid = jobs.filter((job) => job.expiresAt > now);
  if (valid.length !== jobs.length) {
    await writeJobs(valid);
  }
  return valid;
}

/** Remove um job pelo id. */
export async function removeJob(id: string): Promise<void> {
  const jobs = await readJobs();
  const remaining = jobs.filter((job) => job.id !== id);
  if (remaining.length !== jobs.length) {
    await writeJobs(remaining);
  }
}

/** Esvazia a fila local. */
export async function clearOutbox(): Promise<void> {
  await writeJobs([]);
}

async function readJobs(): Promise<OutboxJob[]> {
  const stored = await chrome.storage.local.get(OUTBOX_STORAGE_KEY);
  const value = stored[OUTBOX_STORAGE_KEY];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isOutboxJob);
}

async function writeJobs(jobs: OutboxJob[]): Promise<void> {
  await chrome.storage.local.set({ [OUTBOX_STORAGE_KEY]: jobs });
}

function isOutboxJob(value: unknown): value is OutboxJob {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const job = value as Record<string, unknown>;
  return (
    typeof job.id === 'string' &&
    typeof job.idempotencyKey === 'string' &&
    job.status === 'pendente' &&
    typeof job.createdAt === 'number' &&
    typeof job.expiresAt === 'number' &&
    typeof job.payload === 'object' &&
    job.payload !== null
  );
}
