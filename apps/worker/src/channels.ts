/**
 * Adaptadores de canal de notificação (seção 6 de `notificacoes-whatsapp.md`).
 *
 * A interface `NotificationChannelAdapter` desacopla a regra de negócio do
 * provedor: adicionar e-mail ou Microsoft Teams no futuro não exige alterar o
 * processador. Nesta versão o canal WhatsApp está DESATIVADO por ausência de
 * credenciais oficiais (seção 7.1) e os demais canais estão planejados.
 */
import { NotificationChannel, type NotificationDestination } from '@prisma/client';

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

/**
 * Canal WhatsApp — DESATIVADO.
 *
 * Sem credenciais oficiais da WhatsApp Business Platform / Cloud API (Meta),
 * nenhuma mensagem é enviada. O adaptador é deliberadamente inerte: não faz
 * chamada de rede e não presume elegibilidade de conta, grupos ou templates
 * (seções 7.1 e 11). Retorna `discarded` para que a entrega seja registrada
 * como `DESCARTADO`, sem retentativas inúteis.
 */
export class WhatsAppChannelAdapter implements NotificationChannelAdapter {
  readonly channel = NotificationChannel.WHATSAPP;

  async send(): Promise<ChannelSendResult> {
    return {
      outcome: 'discarded',
      reason:
        'Canal WhatsApp desativado: credenciais oficiais (WhatsApp Business Cloud API) não configuradas.',
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

/** Constrói o registro de adaptadores disponíveis nesta versão. */
export function createChannelRegistry(): ChannelRegistry {
  const registry = new Map<NotificationChannel, NotificationChannelAdapter>();
  registry.set(NotificationChannel.WHATSAPP, new WhatsAppChannelAdapter());
  registry.set(NotificationChannel.EMAIL, new PlannedChannelAdapter(NotificationChannel.EMAIL));
  registry.set(NotificationChannel.TEAMS, new PlannedChannelAdapter(NotificationChannel.TEAMS));
  return registry;
}
