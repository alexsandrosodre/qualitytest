import { ServiceUnavailableException } from '@nestjs/common';
import {
  AiSuggestionType,
  OccurrenceCategory,
  OccurrencePriority,
} from '@qualitytest/shared';

import type { AiCandidateOccurrence, AiOccurrenceInput } from './ai-provider';
import { ExternalAiProvider, type ExternalAiProviderConfig } from './external-ai.provider';

function occurrence(overrides: Partial<AiOccurrenceInput> = {}): AiOccurrenceInput {
  return {
    id: 'occ-1',
    publicCode: 'QT-0001',
    title: 'Falha ao salvar o cadastro',
    description: 'Erro 500 ao confirmar o formulário.',
    categoryId: OccurrenceCategory.OUTROS,
    priority: OccurrencePriority.MEDIA,
    ...overrides,
  };
}

function candidate(publicCode: string, title: string): AiCandidateOccurrence {
  return { id: `id-${publicCode}`, publicCode, title, description: null };
}

/** Resposta fake mínima compatível com o uso no provider. */
function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function chatCompletion(content: string): Response {
  return fakeResponse(200, { choices: [{ message: { content } }] });
}

describe('ExternalAiProvider', () => {
  const config: ExternalAiProviderConfig = {
    baseUrl: 'https://ia.exemplo.local/v1/',
    apiKey: 'segredo-nao-deve-vazar',
    model: 'modelo-teste',
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('está habilitado e identifica provedor/modelo (sem expor segredos)', () => {
    const provider = new ExternalAiProvider(config);

    expect(provider.enabled).toBe(true);
    expect(provider.name).toBe('external-openai-compatible');
    expect(provider.model).toBe('modelo-teste');
  });

  it('chama o endpoint /chat/completions com Bearer e sem vazar a chave no resultado', async () => {
    const fetchMock = jest.fn().mockResolvedValue(chatCompletion('{"suggestions":[]}'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await new ExternalAiProvider(config).suggest({
      occurrence: occurrence(),
      candidates: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ia.exemplo.local/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer segredo-nao-deve-vazar',
    );

    expect(result).toEqual({
      provider: 'external-openai-compatible',
      model: 'modelo-teste',
      suggestions: [],
    });
    expect(JSON.stringify(result)).not.toContain('segredo-nao-deve-vazar');
  });

  it('normaliza e filtra sugestões inválidas', async () => {
    const content = JSON.stringify({
      suggestions: [
        { type: 'RESUMO', value: 'Resumo curto.', confidence: 0.9, rationale: 'ok' },
        { type: 'CATEGORIA', value: OccurrenceCategory.ERRO_VALIDACAO, confidence: 1.5 },
        { type: 'CATEGORIA', value: 'CATEGORIA_INEXISTENTE', confidence: 0.8 },
        { type: 'PRIORIDADE', value: OccurrencePriority.ALTA, confidence: -1 },
        { type: 'DUPLICIDADE', value: 'QT-0002', confidence: 0.7 },
        { type: 'DUPLICIDADE', value: 'QT-9999', confidence: 0.7 },
        { type: 'TIPO_DESCONHECIDO', value: 'x' },
        { type: 'RESUMO', value: '   ' },
      ],
    });

    globalThis.fetch = jest.fn().mockResolvedValue(chatCompletion(content)) as unknown as typeof fetch;

    const result = await new ExternalAiProvider(config).suggest({
      occurrence: occurrence(),
      candidates: [candidate('QT-0002', 'Outro erro de validação')],
    });

    expect(result.suggestions).toEqual([
      { type: AiSuggestionType.RESUMO, value: 'Resumo curto.', confidence: 0.9, rationale: 'ok' },
      {
        type: AiSuggestionType.CATEGORIA,
        value: OccurrenceCategory.ERRO_VALIDACAO,
        confidence: 1,
        rationale: null,
      },
      {
        type: AiSuggestionType.PRIORIDADE,
        value: OccurrencePriority.ALTA,
        confidence: 0,
        rationale: null,
      },
      { type: AiSuggestionType.DUPLICIDADE, value: 'QT-0002', confidence: 0.7, rationale: null },
    ]);
  });

  it('tolera cercas de markdown e devolve lista vazia quando não há JSON', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(chatCompletion('```json\n{"suggestions":[]}\n```')) as unknown as typeof fetch;
    const fenced = await new ExternalAiProvider(config).suggest({
      occurrence: occurrence(),
      candidates: [],
    });
    expect(fenced.suggestions).toEqual([]);

    globalThis.fetch = jest.fn().mockResolvedValue(chatCompletion('sem json aqui')) as unknown as typeof fetch;
    const invalid = await new ExternalAiProvider(config).suggest({
      occurrence: occurrence(),
      candidates: [],
    });
    expect(invalid.suggestions).toEqual([]);
  });

  it('responde indisponível quando o provedor retorna erro HTTP', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(fakeResponse(500, { error: 'boom' })) as unknown as typeof fetch;

    await expect(
      new ExternalAiProvider(config).suggest({ occurrence: occurrence(), candidates: [] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('responde indisponível quando a chamada falha de rede', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    await expect(
      new ExternalAiProvider(config).suggest({ occurrence: occurrence(), candidates: [] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('responde indisponível quando a resposta não tem conteúdo textual', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(fakeResponse(200, { choices: [] })) as unknown as typeof fetch;

    await expect(
      new ExternalAiProvider(config).suggest({ occurrence: occurrence(), candidates: [] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
