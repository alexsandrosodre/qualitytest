import type { AIAnalysis } from '@prisma/client';
import { AiSuggestionType, type AiAnalysisDTO, type AiSuggestionDTO } from '@qualitytest/shared';

/**
 * Views da API de IA. Reutilizam os contratos de `@qualitytest/shared` (os
 * tipos de sugestão não existem no schema Prisma, pois `suggestions` é JSON).
 *
 * `AIAnalysis` nunca armazena segredos: apenas `provider`, `model` e as
 * sugestões geradas.
 */
export type AiSuggestionView = AiSuggestionDTO;
export type AiAnalysisView = AiAnalysisDTO;

const SUGGESTION_TYPES = new Set<string>(Object.values(AiSuggestionType));

/**
 * Valida defensivamente o JSON persistido em `AIAnalysis.suggestions` (o valor
 * pode ter sido gravado por uma versão anterior do provedor). Itens inválidos
 * são descartados em vez de propagados à interface.
 */
function parseSuggestions(value: unknown): AiSuggestionView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const suggestions: AiSuggestionView[] = [];

  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const type = record['type'];
    const suggestionValue = record['value'];

    if (typeof type !== 'string' || !SUGGESTION_TYPES.has(type) || typeof suggestionValue !== 'string') {
      continue;
    }

    suggestions.push({
      type: type as AiSuggestionType,
      value: suggestionValue,
      confidence: typeof record['confidence'] === 'number' ? record['confidence'] : 0,
      rationale: typeof record['rationale'] === 'string' ? record['rationale'] : null,
    });
  }

  return suggestions;
}

export function toAiAnalysisView(analysis: AIAnalysis): AiAnalysisView {
  return {
    id: analysis.id,
    occurrenceId: analysis.occurrenceId,
    provider: analysis.provider,
    model: analysis.model,
    suggestions: parseSuggestions(analysis.suggestions),
    createdAt: analysis.createdAt.toISOString(),
  };
}
