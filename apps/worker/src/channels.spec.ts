/**
 * Testes do adaptador do canal WhatsApp (Cloud API oficial da Meta).
 *
 * Cobrem o comportamento com e sem credenciais e a classificação dos desfechos
 * (enviado / descartado / falha recuperável) independentemente da rede real.
 */
import { NotificationChannel, type NotificationDestination } from '@prisma/client';

import { createChannelRegistry, WhatsAppChannelAdapter } from './channels';
import type { WhatsAppConfig } from './config';

const config: WhatsAppConfig = {
  apiVersion: 'v21.0',
  phoneNumberId: '1234567890',
  accessToken: 'token-oficial-secreto',
  defaultTemplateLanguage: 'pt_BR',
};

function destination(destinationConfig: Record<string, unknown>): NotificationDestination {
  return {
    id: 'dest-1',
    projectId: 'proj-1',
    channel: NotificationChannel.WHATSAPP,
    destinationConfig: destinationConfig as NotificationDestination['destinationConfig'],
    enabled: true,
  };
}

const message = { subject: 'QUALITY TEST — NOVA OCORRÊNCIA', body: 'Corpo da mensagem.' };

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('WhatsAppChannelAdapter', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('permanece inerte e descarta quando não há credenciais (canal desativado)', async () => {
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await new WhatsAppChannelAdapter(null).send({
      destination: destination({ recipientRef: '+5521999999999' }),
      message,
    });

    expect(result.outcome).toBe('discarded');
    if (result.outcome === 'discarded') {
      expect(result.reason).toContain('desativado');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('o registro padrão mantém o WhatsApp desativado (sem credenciais)', () => {
    const adapter = createChannelRegistry().get(NotificationChannel.WHATSAPP);
    expect(adapter).toBeInstanceOf(WhatsAppChannelAdapter);
  });

  it('envia mensagem de texto (sem template) e devolve o providerMessageId', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(fakeResponse(200, { messages: [{ id: 'wamid.TEXTO' }] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await new WhatsAppChannelAdapter(config).send({
      destination: destination({ recipientRef: '+5521999999999' }),
      message,
    });

    expect(result).toEqual({ outcome: 'sent', providerMessageId: 'wamid.TEXTO' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v21.0/1234567890/messages');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer token-oficial-secreto',
    );
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload.type).toBe('text');
    expect(payload.to).toBe('+5521999999999');
  });

  it('usa mensagem de template quando o destino define um template', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(fakeResponse(200, { messages: [{ id: 'wamid.TPL' }] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await new WhatsAppChannelAdapter(config).send({
      destination: destination({ recipientRef: '+5521999999999', template: 'ocorrencia_qtest' }),
      message,
    });

    expect(result).toEqual({ outcome: 'sent', providerMessageId: 'wamid.TPL' });
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as {
      type: string;
      template: { name: string; language: { code: string } };
    };
    expect(payload.type).toBe('template');
    expect(payload.template.name).toBe('ocorrencia_qtest');
    expect(payload.template.language.code).toBe('pt_BR');
  });

  it('descarta (sem retentativa) quando a API rejeita a mensagem com 4xx', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(fakeResponse(400, { error: 'bad request' })) as unknown as typeof fetch;

    const result = await new WhatsAppChannelAdapter(config).send({
      destination: destination({ recipientRef: '+5521999999999' }),
      message,
    });

    expect(result.outcome).toBe('discarded');
  });

  it('trata 429/5xx como falha recuperável (aciona retentativa)', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(fakeResponse(500, {})) as unknown as typeof fetch;
    const serverError = await new WhatsAppChannelAdapter(config).send({
      destination: destination({ recipientRef: '+5521999999999' }),
      message,
    });
    expect(serverError.outcome).toBe('failed');

    globalThis.fetch = jest.fn().mockResolvedValue(fakeResponse(429, {})) as unknown as typeof fetch;
    const throttled = await new WhatsAppChannelAdapter(config).send({
      destination: destination({ recipientRef: '+5521999999999' }),
      message,
    });
    expect(throttled.outcome).toBe('failed');
  });

  it('trata falha de rede como recuperável', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ETIMEDOUT')) as unknown as typeof fetch;

    const result = await new WhatsAppChannelAdapter(config).send({
      destination: destination({ recipientRef: '+5521999999999' }),
      message,
    });

    expect(result.outcome).toBe('failed');
  });

  it('descarta destino com configuração inválida (chave não permitida)', async () => {
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await new WhatsAppChannelAdapter(config).send({
      destination: destination({ token: 'nao-permitido' }),
      message,
    });

    expect(result.outcome).toBe('discarded');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
