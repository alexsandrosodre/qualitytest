/**
 * Sugestão de projeto por domínio/URL (seção 6.2 da especificação mestra).
 *
 * Funções puras: recebem os mapeamentos candidatos e a URL da página em teste e
 * devolvem uma sugestão **sempre confirmável**. Nunca decidem silenciosamente:
 * quando mais de um projeto corresponde, o resultado é marcado como ambíguo.
 */
import type { ProjectSuggestion, ProjectSuggestionResult } from '@qualitytest/shared';

/** Mapeamento de domínio já resolvido com o nome do projeto. */
export interface DomainMappingCandidate {
  projectId: string;
  projectName: string;
  domainPattern: string;
}

/** Normaliza o padrão cadastrado: sem protocolo, sem barra final, minúsculo. */
function normalizePattern(pattern: string): string {
  return pattern
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^\./, '')
    .replace(/\/+$/, '');
}

/**
 * Verifica se a URL corresponde ao padrão de domínio cadastrado.
 *
 * - Padrão **sem** `/`: compara o hostname (igual ou subdomínio do padrão).
 * - Padrão **com** `/`: compara o prefixo `host + pathname`.
 */
export function matchesDomainPattern(pattern: string, url: URL): boolean {
  const normalized = normalizePattern(pattern);
  if (normalized.length === 0) {
    return false;
  }

  const host = url.hostname.toLowerCase();

  if (normalized.includes('/')) {
    const target = `${host}${url.pathname}`.toLowerCase().replace(/\/+$/, '');
    return target === normalized || target.startsWith(`${normalized}/`);
  }

  return host === normalized || host.endsWith(`.${normalized}`);
}

/** Monta a sugestão a partir dos candidatos e da URL informada. */
export function buildProjectSuggestion(
  candidates: readonly DomainMappingCandidate[],
  rawUrl: string,
): ProjectSuggestionResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { suggestions: [], ambiguous: false };
  }

  // Um projeto pode ter vários mapeamentos; deduplica por projectId.
  const matchedProjects = new Map<string, string>();

  for (const candidate of candidates) {
    if (matchesDomainPattern(candidate.domainPattern, url)) {
      matchedProjects.set(candidate.projectId, candidate.projectName);
    }
  }

  if (matchedProjects.size === 0) {
    return { suggestions: [], ambiguous: false };
  }

  const ambiguous = matchedProjects.size > 1;
  const suggestions: ProjectSuggestion[] = [...matchedProjects.entries()].map(
    ([projectId, name]) => ({
      projectId,
      name,
      confidence: ambiguous ? 'media' : 'alta',
    }),
  );

  return { suggestions, ambiguous };
}
