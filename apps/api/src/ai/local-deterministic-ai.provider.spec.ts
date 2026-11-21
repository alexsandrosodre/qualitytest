import { ServiceUnavailableException } from '@nestjs/common';
import { AiSuggestionType, OccurrenceCategory, OccurrencePriority } from '@qualitytest/shared';

import {
  DisabledAiProvider,
  LocalDeterministicAiProvider,
  type AiCandidateOccurrence,
  type AiOccurrenceInput,
} from './ai-provider';

function occurrence(overrides: Partial<AiOccurrenceInput> = {}): AiOccurrenceInput {
  return {
    id: 'occ-1',
    publicCode: 'QT-0001',
    title: 'Título da ocorrência',
    description: null,
    categoryId: OccurrenceCategory.OUTROS,
    priority: OccurrencePriority.MEDIA,
    ...overrides,
  };
}

function candidate(
  id: string,
  publicCode: string,
  title: string,
): AiCandidateOccurrence {
  return { id, publicCode, title, description: null };
}

describe('LocalDeterministicAiProvider', () => {
  const provider = new LocalDeterministicAiProvider();

  it('está habilitado e é identificável (provedor/modelo), sem segredos', () => {
    expect(provider.enabled).toBe(true);
    expect(provider.name).toBe('local-deterministic');
    expect(provider.model).toBe('heuristic-v1');
  });

  it('propõe um resumo a partir da descrição', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({ description: '  Falha   ao salvar o cadastro. ' }),
      candidates: [],
    });

    const summary = result.suggestions.find((item) => item.type === AiSuggestionType.RESUMO);
    expect(summary?.value).toBe('Falha ao salvar o cadastro.');
  });

  it('usa o título como resumo quando não há descrição', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({ description: null, title: 'Botão não responde' }),
      candidates: [],
    });

    const summary = result.suggestions.find((item) => item.type === AiSuggestionType.RESUMO);
    expect(summary?.value).toBe('Botão não responde');
  });

  it('trunca resumos muito longos', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({ description: 'a'.repeat(400) }),
      candidates: [],
    });

    const summary = result.suggestions.find((item) => item.type === AiSuggestionType.RESUMO);
    expect(summary?.value.endsWith('…')).toBe(true);
    expect(summary?.value.length).toBeLessThanOrEqual(241);
  });

  it('sugere categoria por palavras-chave quando difere da atual', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({
        title: 'Integração com a API falha ao sincronizar',
        categoryId: OccurrenceCategory.OUTROS,
      }),
      candidates: [],
    });

    const category = result.suggestions.find((item) => item.type === AiSuggestionType.CATEGORIA);
    expect(category?.value).toBe(OccurrenceCategory.ERRO_INTEGRACAO);
    expect(category?.confidence).toBeGreaterThan(0);
    expect(category?.rationale).toContain('api');
  });

  it('não sugere a categoria quando ela coincide com a atual', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({
        title: 'Integração com a API falha ao sincronizar',
        categoryId: OccurrenceCategory.ERRO_INTEGRACAO,
      }),
      candidates: [],
    });

    expect(result.suggestions.some((item) => item.type === AiSuggestionType.CATEGORIA)).toBe(false);
  });

  it('não sugere categoria quando nenhuma palavra-chave casa', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({ title: 'Assunto genérico sem pistas', description: 'Nada relevante.' }),
      candidates: [],
    });

    expect(result.suggestions.some((item) => item.type === AiSuggestionType.CATEGORIA)).toBe(false);
  });

  it('sugere prioridade CRITICA para indícios graves, quando difere da atual', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({
        title: 'Crash ao salvar',
        description: 'Ocorre perda de dados no cadastro.',
        priority: OccurrencePriority.BAIXA,
      }),
      candidates: [],
    });

    const priority = result.suggestions.find((item) => item.type === AiSuggestionType.PRIORIDADE);
    expect(priority?.value).toBe(OccurrencePriority.CRITICA);
  });

  it('não sugere prioridade quando coincide com a atual', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({ title: 'Crash ao salvar', priority: OccurrencePriority.CRITICA }),
      candidates: [],
    });

    expect(result.suggestions.some((item) => item.type === AiSuggestionType.PRIORIDADE)).toBe(false);
  });

  it('aponta duplicidades por similaridade de título (exclui a própria e as distantes)', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({
        id: 'occ-1',
        title: 'Crash ao salvar cadastro com integração',
        description: null,
      }),
      candidates: [
        candidate('occ-1', 'QT-0001', 'Crash ao salvar cadastro com integração'),
        candidate('occ-2', 'QT-0002', 'Crash ao salvar cadastro com integração com API'),
        candidate('occ-3', 'QT-0003', 'Tela inicial lenta'),
      ],
    });

    const duplicates = result.suggestions.filter((item) => item.type === AiSuggestionType.DUPLICIDADE);
    expect(duplicates.map((item) => item.value)).toEqual(['QT-0002']);
  });

  it('limita a no máximo 3 duplicidades', async () => {
    const result = await provider.suggest({
      occurrence: occurrence({ id: 'occ-1', title: 'Erro ao salvar cadastro de cliente' }),
      candidates: [
        candidate('occ-2', 'QT-0002', 'Erro ao salvar cadastro de cliente'),
        candidate('occ-3', 'QT-0003', 'Erro ao salvar cadastro de cliente'),
        candidate('occ-4', 'QT-0004', 'Erro ao salvar cadastro de cliente'),
        candidate('occ-5', 'QT-0005', 'Erro ao salvar cadastro de cliente'),
      ],
    });

    const duplicates = result.suggestions.filter((item) => item.type === AiSuggestionType.DUPLICIDADE);
    expect(duplicates).toHaveLength(3);
  });
});

describe('DisabledAiProvider', () => {
  it('reporta-se desativado e recusa gerar sugestões', async () => {
    const provider = new DisabledAiProvider();

    expect(provider.enabled).toBe(false);
    await expect(provider.suggest()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
