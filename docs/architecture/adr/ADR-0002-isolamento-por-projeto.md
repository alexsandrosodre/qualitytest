# ADR-0002 — Isolamento Lógico por Projeto

**Versão:** 1.0
**Data:** 21/11/2026
**Status do documento:** Planejado (não implementado)
**Status do ADR:** Proposto
**Contexto da decisão:** ETAPA 1 — Diagnóstico e Arquitetura

---

## Contexto

O QUALITY TEST é multi-projeto. Um mesmo usuário pode participar de vários projetos com uma única conta (seção 2.3), e cada ocorrência deve ser direcionada a um projeto específico, **sem misturar dados, equipes, relatórios ou notificações** (seção 23).

A especificação é explícita: o isolamento lógico deve ser aplicado em todas as camadas e **o filtro visual no frontend não é suficiente** — a autorização deve ser validada no backend em toda operação (seção 2.2). Além disso, "nunca confiar em `projectId` enviado pelo cliente sem validar membership e permissão" (seção 11).

É necessário decidir a estratégia de isolamento antes de implementar autenticação (ETAPA 3), ocorrências (ETAPA 5) e extensão (ETAPA 7).

---

## Decisão

Adotar **isolamento lógico por projeto com validação obrigatória no backend**, combinando RBAC com permissões por projeto:

1. Toda entidade dependente de projeto carrega referência inequívoca ao projeto (`projectId`), com índices e restrições de integridade.
2. A associação usuário↔projeto é feita via `ProjectMember` com `unique(projectId, userId)` e `status` do vínculo.
3. **Em toda operação**, o backend valida a associação **ativa** (`ProjectMember.status = ATIVO`) e o papel/permissão exigidos, via guards (`AuthGuard` + `ProjectGuard`) e um `PolicyService`.
4. O `projectId` recebido do cliente é tratado apenas como **intenção** — nunca como fonte de verdade para autorização.
5. **Filtro obrigatório por projeto** em listagem, pesquisa, exportação, relatórios, comentários, anexos, notificações e extensão.
6. O **ADMINISTRADOR** pode consultar todos os projetos; os demais usuários, apenas projetos vinculados.
7. Anexos acessíveis apenas após validação do vínculo, com URLs assinadas e expiração.
8. Existirão **testes automatizados negativos de isolamento** (usuário sem vínculo não acessa; filtros não vazam; envio com projeto não autorizado é rejeitado; exportações respeitam permissões).

Detalhamento em [permissoes-e-isolamento.md](../permissoes-e-isolamento.md).

---

## Consequências

**Positivas:**
- Prevenção de vazamento de dados entre projetos.
- Cumprimento direto do requisito central do produto.
- Modelo uniforme e auditável de autorização.
- Facilita testes negativos e revisão de segurança.

**Negativas / custos:**
- Toda rota dependente de projeto precisa passar por validação de membership (mais código e possibilidade de erro se esquecida).
- Consultas precisam sempre aplicar o filtro por projeto, o que exige disciplina e testes de regressão.
- A definição precisa de quem pode executar cada operação (células condicionais da matriz) ainda depende de decisão de produto.

**Neutras:**
- A necessidade de índices por projeto ganha importância para desempenho.

---

## Alternativas consideradas

1. **Isolamento apenas no frontend (filtro visual).**
   - Prós: implementação mais simples.
   - Contras: inseguro; contraria explicitamente a especificação.
   - Resultado: **rejeitada**.

2. **ProjectId enviado pelo cliente como fonte de verdade.**
   - Prós: menos consultas de validação.
   - Contras: permite acesso indevido e manipulação de parâmetros.
   - Resultado: **rejeitada**.

3. **Instância/banco separado por projeto (isolamento físico).**
   - Prós: isolamento forte.
   - Contras: complexidade operacional elevada, contraria o requisito de usuário compartilhado entre projetos e a simplicidade pedida.
   - Resultado: **não adotada** (isolamento **lógico** é o definido pela especificação).

4. **Somente papel global (RBAC puro), sem permissões por projeto.**
   - Prós: modelo mais simples.
   - Contras: não permite permissões diferentes por projeto; contraria a seção 3.2.
   - Resultado: **rejeitada**.

---

## Decisões relacionadas

- [ADR-0001 — Stack e monorepo](ADR-0001-stack-e-monorepo.md)
- [ADR-0003 — Autenticação e sessões](ADR-0003-autenticacao-e-sessoes.md)

## Referências

- Especificação mestra, seções 2.2, 2.3, 2.4, 3.2, 11, 23.
- [permissoes-e-isolamento.md](../permissoes-e-isolamento.md)
