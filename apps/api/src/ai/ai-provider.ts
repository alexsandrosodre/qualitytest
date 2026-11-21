import { ServiceUnavailableException } from '@nestjs/common';
import { AiSuggestionType, OccurrenceCategory, OccurrencePriority } from '@qualitytest/shared';

/**
 * Módulo OPCIONAL de IA (seção 8 da especificação).
 *
 * Regras invioláveis deste módulo:
 * - é ASSISTIVO: nunca altera a ocorrência sozinho (toda mudança exige
 *   confirmação humana);
 * - pode ser DESATIVADO (`AI_ENABLED`), e nesse caso nenhuma sugestão é gerada;
 * - registra apenas provedor/modelo — NUNCA armazena segredos;
 * - não envia anexos/screenshots nem dados sensíveis (o provedor recebe apenas
 *   título/descrição/classificação da ocorrência).
 */

/** Token de injeção do provedor de IA. */
export const AI_PROVIDER = 'AI_PROVIDER';

/** Ocorrência submetida à análise (somente campos não sensíveis). */
export interface AiOccurrenceInput {
  id: string;
  publicCode: string;
  title: string;
  description: string | null;
  categoryId: string;
  priority: string;
}

/** Candidata do MESMO projeto, usada apenas para detecção de duplicidade. */
export interface AiCandidateOccurrence {
  id: string;
  publicCode: string;
  title: string;
  description: string | null;
}

export interface AiProviderInput {
  occurrence: AiOccurrenceInput;
  candidates: AiCandidateOccurrence[];
}

export interface AiProviderSuggestion {
  type: AiSuggestionType;
  value: string;
  confidence: number;
  rationale: string | null;
}

export interface AiProviderResult {
  provider: string;
  model: string;
  suggestions: AiProviderSuggestion[];
}

/** Contrato do provedor de IA (implementação local ou adaptador externo). */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  readonly enabled: boolean;
  suggest(input: AiProviderInput): Promise<AiProviderResult>;
}

/** Provedor inativo: usado quando o módulo de IA está desativado. */
export class DisabledAiProvider implements AiProvider {
  readonly name = 'disabled';
  readonly model = 'none';
  readonly enabled = false;

  async suggest(): Promise<AiProviderResult> {
    throw new ServiceUnavailableException(
      'O módulo de IA está desativado. Habilite-o com AI_ENABLED=true para gerar sugestões.',
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Heurísticas do provedor local determinístico                                */
/* -------------------------------------------------------------------------- */

const MAX_SUMMARY_LENGTH = 240;
const MAX_DUPLICATES = 3;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.5;

interface CategoryHeuristic {
  category: string;
  keywords: readonly string[];
}

interface PriorityHeuristic {
  priority: string;
  keywords: readonly string[];
}

/**
 * Palavras-chave (sem acentos — o texto é normalizado antes da busca) para a
 * sugestão de categoria. A ordem não importa: vence a categoria com maior
 * pontuação. `ERRO_FUNCIONAL` NÃO entra aqui: por ser genérica, só é sugerida
 * como fallback quando nenhuma categoria específica casa (ver `FUNCTIONAL_KEYWORDS`).
 */
const CATEGORY_KEYWORDS: readonly CategoryHeuristic[] = [
  {
    category: OccurrenceCategory.ERRO_VISUAL,
    keywords: ['layout', 'visual', 'css', 'estilo', 'alinhament', 'responsiv', 'icone', 'imagem', 'renderiza', 'tipografia', 'fonte'],
  },
  {
    category: OccurrenceCategory.ERRO_INTEGRACAO,
    keywords: ['integracao', 'api', 'webhook', 'endpoint', 'sincroniz', 'gateway', 'conexao', 'servico externo'],
  },
  {
    category: OccurrenceCategory.ERRO_VALIDACAO,
    keywords: ['validaca', 'formulario', 'campo', 'obrigator', 'mascara', 'formato invalido', 'cadastro'],
  },
  {
    category: OccurrenceCategory.DESEMPENHO,
    keywords: ['lent', 'desempenh', 'performance', 'trav', 'demora', 'carregament'],
  },
  {
    category: OccurrenceCategory.SEGURANCA,
    keywords: ['seguranc', 'autentica', 'autoriza', 'permiss', 'vazament', 'cripto', 'acesso indevido'],
  },
  {
    category: OccurrenceCategory.ACESSIBILIDADE,
    keywords: ['acessibil', 'leitor de tela', 'contraste', 'aria', 'navegacao por teclado'],
  },
  {
    category: OccurrenceCategory.COMPATIBILIDADE,
    keywords: ['navegador', 'compatibil', 'versao', 'dispositivo', 'mobile', 'ios', 'android', 'safari', 'chrome'],
  },
];

/** Palavras-chave genéricas de erro (categoria de fallback `ERRO_FUNCIONAL`). */
const FUNCTIONAL_KEYWORDS: readonly string[] = [
  'erro',
  'falha',
  'nao funciona',
  'quebr',
  'crash',
  'exception',
  'bug',
];

/**
 * Palavras-chave de severidade, avaliadas em ordem decrescente de gravidade
 * (a primeira que casar define a sugestão).
 */
const PRIORITY_KEYWORDS: readonly PriorityHeuristic[] = [
  {
    priority: OccurrencePriority.CRITICA,
    keywords: ['perda de dados', 'crash', 'indisponiv', 'producao', 'pagamento', 'financeir', 'seguranc'],
  },
  {
    priority: OccurrencePriority.ALTA,
    keywords: ['nao funciona', 'bloque', 'bloqueante', 'erro 500', 'urgente', 'critic', 'impede'],
  },
  {
    priority: OccurrencePriority.MEDIA,
    keywords: ['lent', 'intermitent', 'as vezes', 'eventual', 'instabil'],
  },
  {
    priority: OccurrencePriority.BAIXA,
    keywords: ['cosmetic', 'visual', 'texto', 'typo', 'ortograf', 'melhoria', 'sugestao', 'pequen'],
  },
];

/** Normaliza o texto (minúsculas, sem acentos) para a busca por palavras-chave. */
function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Tokens significativos (>= 3 caracteres) para comparação de títulos. */
function tokenize(text: string): Set<string> {
  const tokens = normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
  return new Set(tokens);
}

/** Similaridade de Jaccard entre dois conjuntos de tokens (0 a 1). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Resumo curto e determinístico (descrição; cai para o título quando vazia). */
function buildSummary(occurrence: AiOccurrenceInput): string | null {
  const source = (occurrence.description ?? '').trim() === '' ? occurrence.title : (occurrence.description ?? '');
  const collapsed = source.replace(/\s+/g, ' ').trim();

  if (collapsed === '') {
    return null;
  }
  if (collapsed.length <= MAX_SUMMARY_LENGTH) {
    return collapsed;
  }

  return `${collapsed.slice(0, MAX_SUMMARY_LENGTH).trimEnd()}…`;
}

interface HeuristicMatch {
  value: string;
  confidence: number;
  matched: string[];
}

/** Categoria inferida pelas palavras-chave (ou `null` quando nada casa). */
function inferCategory(occurrence: AiOccurrenceInput): HeuristicMatch | null {
  const title = normalizeText(occurrence.title);
  const description = normalizeText(occurrence.description ?? '');

  let best: { value: string; score: number; matched: string[] } | null = null;

  for (const entry of CATEGORY_KEYWORDS) {
    const matched = entry.keywords.filter((keyword) => title.includes(keyword) || description.includes(keyword));
    if (matched.length === 0) {
      continue;
    }

    const score = matched.reduce(
      (accumulator, keyword) => accumulator + (title.includes(keyword) ? 2 : 1),
      0,
    );

    if (best === null || score > best.score) {
      best = { value: entry.category, score, matched };
    }
  }

  if (best === null) {
    // Fallback: apenas indícios genéricos de erro → categoria funcional.
    const matched = FUNCTIONAL_KEYWORDS.filter(
      (keyword) => title.includes(keyword) || description.includes(keyword),
    );
    if (matched.length === 0) {
      return null;
    }
    const score = matched.reduce(
      (accumulator, keyword) => accumulator + (title.includes(keyword) ? 2 : 1),
      0,
    );
    return {
      value: OccurrenceCategory.ERRO_FUNCIONAL,
      confidence: round2(Math.min(0.9, 0.4 + score * 0.1)),
      matched,
    };
  }

  return {
    value: best.value,
    confidence: round2(Math.min(0.9, 0.4 + best.score * 0.1)),
    matched: best.matched,
  };
}

/** Prioridade inferida pelas palavras-chave (ou `null` quando nada casa). */
function inferPriority(occurrence: AiOccurrenceInput): HeuristicMatch | null {
  const title = normalizeText(occurrence.title);
  const description = normalizeText(occurrence.description ?? '');

  for (const entry of PRIORITY_KEYWORDS) {
    const matched = entry.keywords.filter((keyword) => title.includes(keyword) || description.includes(keyword));
    if (matched.length > 0) {
      return {
        value: entry.priority,
        confidence: round2(Math.min(0.9, 0.4 + matched.length * 0.1)),
        matched,
      };
    }
  }

  return null;
}

/** Ocorrências candidatas com título semelhante (possíveis duplicatas). */
function findDuplicates(
  occurrence: AiOccurrenceInput,
  candidates: readonly AiCandidateOccurrence[],
): Array<{ publicCode: string; similarity: number }> {
  const tokens = tokenize(occurrence.title);
  if (tokens.size === 0) {
    return [];
  }

  const results: Array<{ publicCode: string; similarity: number }> = [];

  for (const candidate of candidates) {
    if (candidate.id === occurrence.id) {
      continue;
    }

    const similarity = jaccard(tokens, tokenize(candidate.title));
    if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD) {
      results.push({ publicCode: candidate.publicCode, similarity: round2(similarity) });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity || a.publicCode.localeCompare(b.publicCode));
  return results.slice(0, MAX_DUPLICATES);
}

/**
 * Provedor local DETERMINÍSTICO (sem rede, sem credenciais).
 *
 * Não requer nenhum serviço externo: aplica heurísticas de palavras-chave e
 * similaridade de títulos. É a implementação padrão quando `AI_ENABLED=true` e
 * `AI_PROVIDER=local`. O adaptador externo compatível com OpenAI está
 * implementado em `external-ai.provider.ts` e é selecionado com
 * `AI_PROVIDER=external` (exige `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`).
 */
export class LocalDeterministicAiProvider implements AiProvider {
  readonly name = 'local-deterministic';
  readonly model = 'heuristic-v1';
  readonly enabled = true;

  async suggest(input: AiProviderInput): Promise<AiProviderResult> {
    const suggestions: AiProviderSuggestion[] = [];

    const summary = buildSummary(input.occurrence);
    if (summary !== null) {
      suggestions.push({
        type: AiSuggestionType.RESUMO,
        value: summary,
        confidence: 0.5,
        rationale: 'Resumo derivado da descrição (heurística local determinística).',
      });
    }

    const category = inferCategory(input.occurrence);
    if (category !== null && category.value !== input.occurrence.categoryId) {
      suggestions.push({
        type: AiSuggestionType.CATEGORIA,
        value: category.value,
        confidence: category.confidence,
        rationale: `Palavras-chave identificadas: ${category.matched.join(', ')}.`,
      });
    }

    const priority = inferPriority(input.occurrence);
    if (priority !== null && priority.value !== input.occurrence.priority) {
      suggestions.push({
        type: AiSuggestionType.PRIORIDADE,
        value: priority.value,
        confidence: priority.confidence,
        rationale: `Indícios de severidade: ${priority.matched.join(', ')}.`,
      });
    }

    for (const duplicate of findDuplicates(input.occurrence, input.candidates)) {
      suggestions.push({
        type: AiSuggestionType.DUPLICIDADE,
        value: duplicate.publicCode,
        confidence: duplicate.similarity,
        rationale: `Título semelhante ao da ocorrência ${duplicate.publicCode}.`,
      });
    }

    return { provider: this.name, model: this.model, suggestions };
  }
}
