import { buildProjectSuggestion, matchesDomainPattern } from './project-suggestion';

describe('matchesDomainPattern', () => {
  it('casa hostname exato', () => {
    expect(matchesDomainPattern('homolog.exemplo.invalid', new URL('https://homolog.exemplo.invalid/a/b'))).toBe(true);
  });

  it('casa subdomínio do padrão', () => {
    expect(matchesDomainPattern('exemplo.invalid', new URL('https://app.exemplo.invalid/x'))).toBe(true);
  });

  it('não casa domínio diferente', () => {
    expect(matchesDomainPattern('exemplo.invalid', new URL('https://outro.invalid/'))).toBe(false);
  });

  it('ignora protocolo e barra final no padrão', () => {
    expect(matchesDomainPattern('https://exemplo.invalid/', new URL('https://exemplo.invalid/'))).toBe(true);
  });

  it('aceita curinga com ponto inicial', () => {
    expect(matchesDomainPattern('.exemplo.invalid', new URL('https://sub.exemplo.invalid/'))).toBe(true);
  });

  it('casa por prefixo de caminho quando o padrão contém barra', () => {
    expect(matchesDomainPattern('exemplo.invalid/portal', new URL('https://exemplo.invalid/portal/pedidos'))).toBe(true);
    expect(matchesDomainPattern('exemplo.invalid/portal', new URL('https://exemplo.invalid/outro'))).toBe(false);
  });

  it('rejeita padrão vazio', () => {
    expect(matchesDomainPattern('   ', new URL('https://exemplo.invalid/'))).toBe(false);
  });
});

describe('buildProjectSuggestion', () => {
  const candidates = [
    { projectId: 'p1', projectName: 'Intranet', domainPattern: 'intranet.invalid' },
    { projectId: 'p1', projectName: 'Intranet', domainPattern: 'www.intranet.invalid' },
    { projectId: 'p2', projectName: 'Portal', domainPattern: 'portal.invalid' },
  ];

  it('retorna vazio quando não há correspondência', () => {
    expect(buildProjectSuggestion(candidates, 'https://nada.invalid/')).toEqual({
      suggestions: [],
      ambiguous: false,
    });
  });

  it('deduplica projeto com múltiplos mapeamentos e marca confiança alta', () => {
    expect(buildProjectSuggestion(candidates, 'https://intranet.invalid/painel')).toEqual({
      suggestions: [{ projectId: 'p1', name: 'Intranet', confidence: 'alta' }],
      ambiguous: false,
    });
  });

  it('marca ambíguo quando dois projetos correspondem', () => {
    const result = buildProjectSuggestion(
      [
        { projectId: 'p1', projectName: 'A', domainPattern: 'exemplo.invalid' },
        { projectId: 'p2', projectName: 'B', domainPattern: 'exemplo.invalid' },
      ],
      'https://exemplo.invalid/',
    );

    expect(result.ambiguous).toBe(true);
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.every((item) => item.confidence === 'media')).toBe(true);
  });

  it('retorna vazio para URL inválida', () => {
    expect(buildProjectSuggestion(candidates, 'não é url')).toEqual({
      suggestions: [],
      ambiguous: false,
    });
  });
});
