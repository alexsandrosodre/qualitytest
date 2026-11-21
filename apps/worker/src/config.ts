/**
 * Configuração do worker de notificações (ETAPA 8).
 *
 * Centraliza a leitura do ambiente para que o bootstrap e o processador não
 * conheçam detalhes de variáveis de ambiente.
 */
import path from 'node:path';

// Carrega o `.env` da raiz do monorepo quando existir (node >= 20.12).
// O arquivo é opcional: em ambientes de execução as variáveis vêm do próprio ambiente.
try {
  process.loadEnvFile(path.resolve(__dirname, '../../../.env'));
} catch {
  // Sem `.env` na raiz: segue com as variáveis já presentes no ambiente.
}

/** Nome da fila de notificações (compartilhado com a API). */
export const NOTIFICATIONS_QUEUE = 'notifications';

/** Nome da fila de mensagens mortas (DLQ) do canal de notificações. */
export const NOTIFICATIONS_DLQ = `${NOTIFICATIONS_QUEUE}-dlq`;

export interface RedisConnectionOptions {
  host: string;
  port: number;
  db: number;
  password?: string;
}

export interface WorkerConfig {
  connection: RedisConnectionOptions;
  /** Número de jobs processados em paralelo. */
  concurrency: number;
  /** URL pública do frontend usada no link autenticado da mensagem (opcional). */
  webBaseUrl: string | null;
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

export function readWorkerConfig(): WorkerConfig {
  const rawConcurrency = Number.parseInt(process.env.NOTIFICATIONS_CONCURRENCY ?? '5', 10);
  const webBaseUrl = (process.env.WEB_BASE_URL ?? '').trim().replace(/\/+$/, '');

  return {
    connection: readRedisConnection(),
    concurrency: Number.isNaN(rawConcurrency) || rawConcurrency < 1 ? 5 : rawConcurrency,
    webBaseUrl: webBaseUrl.length === 0 ? null : webBaseUrl,
  };
}

/**
 * Credenciais oficiais da WhatsApp Business Platform / Cloud API (Meta).
 *
 * NUNCA são versionadas: vêm do ambiente. Enquanto ausentes, o canal permanece
 * DESATIVADO (nenhuma chamada de rede é feita) — ver `channels.ts`.
 */
export interface WhatsAppConfig {
  /** Versão da Graph API (ex.: `v21.0`). */
  apiVersion: string;
  /** Identificador do número de telefone remetente (Phone Number ID). */
  phoneNumberId: string;
  /** Token de acesso da Cloud API (segredo — nunca persistido nem logado). */
  accessToken: string;
  /** Nome do template aprovado (opcional; quando ausente envia-se texto livre). */
  defaultTemplateName?: string;
  /** Código de idioma do template (ex.: `pt_BR`). */
  defaultTemplateLanguage: string;
}

/**
 * Lê as credenciais da WhatsApp Cloud API do ambiente. Retorna `null` quando
 * `WHATSAPP_PHONE_NUMBER_ID` ou `WHATSAPP_CLOUD_API_TOKEN` estão ausentes, e
 * nesse caso o canal continua desativado (sem chamadas de rede).
 */
export function readWhatsAppConfig(): WhatsAppConfig | null {
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim();
  const accessToken = (process.env.WHATSAPP_CLOUD_API_TOKEN ?? '').trim();

  if (phoneNumberId === '' || accessToken === '') {
    return null;
  }

  const templateName = (process.env.WHATSAPP_TEMPLATE_NAME ?? '').trim();

  return {
    apiVersion: (process.env.WHATSAPP_API_VERSION ?? 'v21.0').trim(),
    phoneNumberId,
    accessToken,
    defaultTemplateLanguage: (process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'pt_BR').trim(),
    ...(templateName === '' ? {} : { defaultTemplateName: templateName }),
  };
}

/** Contexto de log do worker (permite injetar um logger nos testes). */
export interface WorkerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
