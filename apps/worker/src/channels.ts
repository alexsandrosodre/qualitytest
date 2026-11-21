/**
 * Adaptadores de canal de notificação (seção 6 de `notificacoes-whatsapp.md`).
 *
 * A interface `NotificationChannelAdapter` desacopla a regra de negócio do
 * provedor: adicionar e-mail ou Microsoft Teams no futuro não exige alterar o
 * processador. O canal WhatsApp usa a WhatsApp Business Platform / Cloud API
 * OFICIAL da Meta; sem credenciais oficiais ele permanece DESATIVADO (nenhuma
 * chamada de rede) e os demais canais seguem planejados.
 */
import { NotificationChannel, type NotificationDestination } from '@prisma/client';
import { validateChannelConfig } from '@qualitytest/shared';

import type { WhatsAppConfig } from './config';

/** Mensagem padronizada pronta para envio em qualquer canal. */
export interface DeliveryMessage {
  subject: string;
  body: string;
}

export interface ChannelSendInput {
  destination: NotificationDestination;
  message: DeliveryMessage;
}

/**
 * Resultado de uma tentativa de envio.
 *
 * - `sent`: enviado com sucesso (registra `providerMessageId`).
 * - `discarded`: não houve envio e não deve haver retentativa (canal
 *   desativado/planejado ou destino desabilitado) — registra `DESCARTADO`.
 * - `failed`: falha recuperável do provedor — registra `FALHA` e permite
 *   retentativa com backoff.
 */
export type ChannelSendResult =
  | { outcome: 'sent'; providerMessageId: string | null }
  | { outcome: 'discarded'; reason: string }
  | { outcome: 'failed'; error: string };

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  send(input: ChannelSendInput): Promise<ChannelSendResult>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Canal WhatsApp — WhatsApp Business Platform / Cloud API OFICIAL (Meta).
 *
 * IMPORTANTE (seção 7.1): não presumimos elegibilidade de conta nem o envio a
 * grupos preexistentes. O destino é um `recipientRef` (número/identificador
 * autorizado) configurado por projeto; a elegibilidade e os templates devem ser
 * verificados na documentação oficial. Sem credenciais (`config === null`), o
 * adaptador é INERTE: não faz chamada de rede e retorna `discarded`, para que a
 * entrega seja registrada como `DESCARTADO` sem retentativas inúteis.
 *
 * Quando há credenciais, envia via `POST {graph}/{version}/{phoneNumberId}/messages`:
 * - se houver template (destino ou `WHATSAPP_TEMPLATE_NAME`), envia mensagem de template;
 * - caso contrário, envia texto livre (válido na janela de atendimento de 24h).
 * O token nunca é registrado — apenas o status HTTP e o `providerMessageId`.
 */
export class WhatsAppChannelAdapter implements NotificationChannelAdapter {
  readonly channel = NotificationChannel.WHATSAPP;

  constructor(private readonly config: WhatsAppConfig | null = null) {}

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (this.config === null) {
      return {
        outcome: 'discarded',
        reason:
          'Canal WhatsApp desativado: credenciais oficiais (WhatsApp Business Cloud API) não configuradas.',
      };
    }

    const destinationConfig = asRecord(input.destination.destinationConfig);
    if (destinationConfig === null) {
      return { outcome: 'discarded', reason: 'Destino WhatsApp sem configuração válida.' };
    }

    const validation = validateChannelConfig(NotificationChannel.WHATSAPP, destinationConfig);
    if (!validation.valid) {
      return { outcome: 'discarded', reason: `Destino WhatsApp inválido: ${validation.reason}` };
    }

    const recipientRef = destinationConfig.recipientRef;
    if (typeof recipientRef !== 'string' || recipientRef.trim() === '') {
      return { outcome: 'discarded', reason: 'Destino WhatsApp sem destinatário (recipientRef).' };
    }

    const configuredTemplate = destinationConfig.template;
    const templateName =
      typeof configuredTemplate === 'string' && configuredTemplate.trim() !== ''
        ? configuredTemplate.trim()
        : this.config.defaultTemplateName;

    const payload =
      templateName !== undefined && templateName !== ''
        ? {
            messaging_product: 'whatsapp',
            to: recipientRef.trim(),
            type: 'template',
            template: {
              name: templateName,
              language: { code: this.config.defaultTemplateLanguage },
              components: [
                { type: 'body', parameters: [{ type: 'text', text: input.message.body }] },
              ],
            },
          }
        : {
            messaging_product: 'whatsapp',
            to: recipientRef.trim(),
            type: 'text',
            text: { preview_url: false, body: input.message.body },
          };

    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (error: unknown) {
      // Falha de rede é recuperável → aciona a retentativa com backoff.
      return {
        outcome: 'failed',
        error: `Falha ao contatar a WhatsApp Cloud API: ${describeError(error)}`,
      };
    }

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as {
        messages?: Array<{ id?: unknown }>;
      } | null;
      const messageId = body?.messages?.[0]?.id;
      return {
        outcome: 'sent',
        providerMessageId: typeof messageId === 'string' ? messageId : null,
      };
    }

    // 429 (limite/rate) e 5xx são recuperáveis; os demais 4xx não.
    if (response.status === 429 || response.status >= 500) {
      return { outcome: 'failed', error: `WhatsApp Cloud API respondeu HTTP ${response.status}.` };
    }

    return {
      outcome: 'discarded',
      reason: `WhatsApp Cloud API rejeitou a mensagem (HTTP ${response.status}); nova tentativa não resolveria.`,
    };
  }
}

/**
 * Adaptador de canal planejado (e-mail, Teams). Mantido para registrar a
 * intenção arquitetural sem simular envios: sempre retorna `discarded`.
 */
export class PlannedChannelAdapter implements NotificationChannelAdapter {
  constructor(readonly channel: NotificationChannel) {}

  async send(): Promise<ChannelSendResult> {
    return {
      outcome: 'discarded',
      reason: `Canal ${this.channel} planejado para versão futura; nenhum envio realizado.`,
    };
  }
}

export type ChannelRegistry = ReadonlyMap<NotificationChannel, NotificationChannelAdapter>;

/**
 * Constrói o registro de adaptadores disponíveis nesta versão.
 *
 * `whatsapp` traz as credenciais oficiais (ou `null` para canal desativado).
 * O bootstrap do worker passa `readWhatsAppConfig()`; nos testes o padrão `null`
 * mantém o canal inerte, sem risco de chamadas de rede acidentais.
 */
export function createChannelRegistry(whatsapp: WhatsAppConfig | null = null): ChannelRegistry {
  const registry = new Map<NotificationChannel, NotificationChannelAdapter>();
  registry.set(NotificationChannel.WHATSAPP, new WhatsAppChannelAdapter(whatsapp));
  registry.set(NotificationChannel.EMAIL, new PlannedChannelAdapter(NotificationChannel.EMAIL));
  registry.set(NotificationChannel.TEAMS, new PlannedChannelAdapter(NotificationChannel.TEAMS));
  return registry;
}
