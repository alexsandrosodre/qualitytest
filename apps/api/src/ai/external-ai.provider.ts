import { ServiceUnavailableException } from '@nestjs/common';
import {
  AI_SUGGESTION_TYPES,
  AiSuggestionType,
  OCCURRENCE_CATEGORIES,
  OCCURRENCE_PRIORITIES,
} from '@qualitytest/shared';

import type {
  AiProvider,
  AiProviderInput,
  AiProviderResult,
  AiProviderSuggestion,
} from './ai-provider';

/**
 * Adaptador EXTERNO de IA (provedor compatível com a API OpenAI
 * `POST {baseUrl}/chat/completions`).
 *
 * Regras invioláveis preservadas do módulo (seção 8):
 * - é ASSISTIVO: apenas sugere; aplicar exige confirmação humana;
 * - recebe SOMENTE dados não sensíveis (título/descrição/classificação e, na
 *   duplicidade, os títulos/códigos de ocorrências do MESMO projeto);
 * - NUNCA persiste segredos: apenas `provider`/`model` são registrados;
 * - se a chamada falhar, responde indisponível — o núcleo (ocorrência) não é
 *   afetado, pois a IA não está no caminho crítico.
 *
 * O adaptador só é instanciado quando `AI_PROVIDER=external` E as credenciais
 * (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`) estão presentes (ver `ai.module.ts`).
 */

const MAX_SUMMARY_LENGTH = 240;
const DEFAULT_TIMEOUT_MS = 20_000;

/** Configuração injetada do adaptador externo. */
export interface ExternalAiProviderConfig {
  /** URL base compatível com OpenAI, incluindo o prefixo de versão (ex.: `https://api.openai.com/v1`). */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Tempo-limite da chamada HTTP em milissegundos. */
  timeoutMs?: number;
}

const SYSTEM_PROMPT = [
  'Você é um assistente de QUALIDADE de software do sistema QUALITY TEST.',
  'Responda APENAS com um objeto JSON válido, sem texto fora do JSON e sem markdown.',
  'Formato exato: {"suggestions":[{"type":"RESUMO","value":"...","confidence":0.0,"rationale":"..."}]}',
  'Tipos permitidos em "type": RESUMO, CATEGORIA, PRIORIDADE, DUPLICIDADE.',
  `- RESUMO: resumo objetivo da ocorrência (no máximo ${MAX_SUMMARY_LENGTH} caracteres).`,
  '- CATEGORIA: "value" deve ser EXATAMENTE um dos valores de "allowedCategories".',
  '- PRIORIDADE: "value" deve ser EXATAMENTE um dos valores de "allowedPriorities".',
  '- DUPLICIDADE: "value" deve ser o "publicCode" de uma ocorrência de "candidateOccurrences".',
  '- "confidence" é um número entre 0 e 1; "rationale" é uma justificativa curta.',
  'Não invente dados. Se não houver sugestão aplicável, devolva {"suggestions":[]}.',
].join('\n');

/** Remove a barra final da URL para concatenar o caminho do endpoint. */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Extrai o primeiro objeto JSON do conteúdo (tolera cercas ```json). */
function parseJsonObject(content: string): Record<string, unknown> | null {
  const direct = tryParse(content);
  if (direct !== null) {
    return direct;
  }

  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }
  return tryParse(content.slice(start, end + 1));
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

/**
 * Valida e normaliza as sugestões devolvidas pelo provedor contra os domínios
 * conhecidos. Sugestões inválidas (tipo/valor desconhecidos) são descartadas.
 */
function normalizeSuggestions(
  raw: unknown,
  input: AiProviderInput,
): AiProviderSuggestion[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const candidateCodes = new Set(input.candidates.map((candidate) => candidate.publicCode));
  const suggestions: AiProviderSuggestion[] = [];

  for (const item of raw) {
    const entry = asRecord(item);
    if (entry === null) {
      continue;
    }

    const type = asString(entry.type);
    const value = asString(entry.value)?.trim() ?? '';
    if (type === null || value === '' || !AI_SUGGESTION_TYPES.includes(type as AiSuggestionType)) {
      continue;
    }

    let normalizedValue = value;
    if (type === AiSuggestionType.RESUMO) {
      normalizedValue =
        value.length <= MAX_SUMMARY_LENGTH ? value : `${value.slice(0, MAX_SUMMARY_LENGTH).trimEnd()}…`;
    } else if (type === AiSuggestionType.CATEGORIA) {
      if (!OCCURRENCE_CATEGORIES.includes(value as (typeof OCCURRENCE_CATEGORIES)[number])) {
        continue;
      }
    } else if (type === AiSuggestionType.PRIORIDADE) {
      if (!OCCURRENCE_PRIORITIES.includes(value as (typeof OCCURRENCE_PRIORITIES)[number])) {
        continue;
      }
    } else if (type === AiSuggestionType.DUPLICIDADE) {
      if (!candidateCodes.has(value)) {
        continue;
      }
    }

    const rawConfidence = entry.confidence;
    const confidence =
      typeof rawConfidence === 'number' ? round2(clamp01(rawConfidence)) : 0.5;

    const rationale = asString(entry.rationale)?.trim();

    suggestions.push({
      type: type as AiSuggestionType,
      value: normalizedValue,
      confidence,
      rationale: rationale === undefined || rationale === '' ? null : rationale,
    });
  }

  return suggestions;
}

/** Monta o conteúdo do usuário (somente dados não sensíveis). */
function buildUserContent(input: AiProviderInput): string {
  return JSON.stringify({
    occurrence: {
      publicCode: input.occurrence.publicCode,
      title: input.occurrence.title,
      description: input.occurrence.description,
      categoryId: input.occurrence.categoryId,
      priority: input.occurrence.priority,
    },
    allowedCategories: OCCURRENCE_CATEGORIES,
    allowedPriorities: OCCURRENCE_PRIORITIES,
    candidateOccurrences: input.candidates.map((candidate) => ({
      publicCode: candidate.publicCode,
      title: candidate.title,
      description: candidate.description,
    })),
  });
}

export class ExternalAiProvider implements AiProvider {
  readonly name = 'external-openai-compatible';

  readonly model: string;

  readonly enabled = true;

  private readonly endpoint: string;

  private readonly apiKey: string;

  private readonly timeoutMs: number;

  constructor(config: ExternalAiProviderConfig) {
    this.model = config.model;
    this.endpoint = `${stripTrailingSlash(config.baseUrl)}/chat/completions`;
    this.apiKey = config.apiKey;
    this.timeoutMs =
      config.timeoutMs !== undefined && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS;
  }

  async suggest(input: AiProviderInput): Promise<AiProviderResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserContent(input) },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error: unknown) {
      throw new ServiceUnavailableException(
        `Provedor de IA indisponível: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Não repassamos o corpo do erro do provedor (pode conter detalhes internos).
      throw new ServiceUnavailableException(
        `Provedor de IA retornou HTTP ${response.status}. Tente novamente mais tarde.`,
      );
    }

    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    } | null;

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new ServiceUnavailableException('Resposta do provedor de IA em formato inesperado.');
    }

    const parsed = parseJsonObject(content);
    const suggestions = parsed === null ? [] : normalizeSuggestions(parsed.suggestions, input);

    return { provider: this.name, model: this.model, suggestions };
  }
}
