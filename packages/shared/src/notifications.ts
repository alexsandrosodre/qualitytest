/**
 * Regras de configuração dos destinos de notificação (seção 7 da especificação
 * mestra e `docs/architecture/notificacoes-whatsapp.md`).
 *
 * Fonte única compartilhada entre a API (valida na configuração do destino) e o
 * worker (revalida antes de enviar), garantindo que `destinationConfig` NUNCA
 * armazene segredos em texto aberto: apenas as chaves da lista permitida de cada
 * canal são aceitas.
 */

import { NotificationChannel } from './enums';

/** Tipo esperado do valor de um campo de configuração de canal. */
export type ChannelConfigValueKind = 'string' | 'emailList';

/** Descrição de um campo permitido em `destinationConfig` para um canal. */
export interface ChannelConfigField {
  key: string;
  required: boolean;
  kind: ChannelConfigValueKind;
  /** Comprimento máximo quando `kind === 'string'`. */
  maxLength?: number;
  /** Quantidade máxima de itens quando `kind === 'emailList'`. */
  maxItems?: number;
}

export type ChannelConfigValidation = { valid: true } | { valid: false; reason: string };

/**
 * Campos permitidos por canal. Qualquer chave fora desta lista é rejeitada,
 * o que impede o armazenamento de tokens/segredos em `destinationConfig`.
 */
export const NOTIFICATION_CHANNEL_CONFIG_SPEC: Record<NotificationChannel, ChannelConfigField[]> =
  {
    [NotificationChannel.WHATSAPP]: [
      { key: 'recipientRef', required: true, kind: 'string', maxLength: 160 },
      { key: 'template', required: false, kind: 'string', maxLength: 120 },
    ],
    [NotificationChannel.EMAIL]: [
      { key: 'recipients', required: true, kind: 'emailList', maxItems: 20 },
    ],
    [NotificationChannel.TEAMS]: [
      { key: 'webhookRef', required: true, kind: 'string', maxLength: 300 },
    ],
  };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida `destinationConfig` contra a lista permitida do canal informado. */
export function validateChannelConfig(
  channel: string,
  config: Record<string, unknown>,
): ChannelConfigValidation {
  const fields = NOTIFICATION_CHANNEL_CONFIG_SPEC[channel as NotificationChannel];

  if (fields === undefined) {
    return { valid: false, reason: `Canal de notificação desconhecido: "${channel}".` };
  }

  const allowedKeys = new Set(fields.map((field) => field.key));

  for (const key of Object.keys(config)) {
    if (!allowedKeys.has(key)) {
      return {
        valid: false,
        reason: `Chave de configuração não permitida para o canal ${channel}: "${key}".`,
      };
    }
  }

  for (const field of fields) {
    const value = config[field.key];

    if (value === undefined || value === null) {
      if (field.required) {
        return { valid: false, reason: `Campo obrigatório ausente: "${field.key}".` };
      }
      continue;
    }

    if (field.kind === 'string') {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return { valid: false, reason: `"${field.key}" deve ser um texto não vazio.` };
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        return {
          valid: false,
          reason: `"${field.key}" excede o limite de ${field.maxLength} caracteres.`,
        };
      }
      continue;
    }

    if (!Array.isArray(value) || value.length === 0) {
      return { valid: false, reason: `"${field.key}" deve ser uma lista não vazia.` };
    }
    if (field.maxItems !== undefined && value.length > field.maxItems) {
      return { valid: false, reason: `"${field.key}" excede o limite de ${field.maxItems} itens.` };
    }
    for (const item of value) {
      if (typeof item !== 'string' || !EMAIL_PATTERN.test(item.trim())) {
        return { valid: false, reason: `"${field.key}" contém um e-mail inválido.` };
      }
    }
  }

  return { valid: true };
}
