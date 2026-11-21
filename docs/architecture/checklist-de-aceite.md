# Checklist de Aceite

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado

---

## 1. Objetivo

Reproduzir, item a item, a **CHECKLIST FINAL DE ENTREGA** (seção 22 da especificação mestra), registrando o estado **real** de cada item na data desta versão.

**Legenda:** `[x]` = atendido · `[ ]` = pendente.

> Avaliação honesta: itens marcados `[x]` correspondem a implementação verificável no repositório; itens `[ ]` são pendências registradas em [pendencias-conhecidas.md](pendencias-conhecidas.md).

---

## 2. Produto

- [x] **Cadastro e gestão de usuários.** Endpoints `POST/GET /api/users`, `GET/PATCH /api/users/:id`, `PATCH /api/users/:id/status` (somente `ADMINISTRADOR`).
- [x] **Usuário participa de múltiplos projetos com uma única conta.** Modelo `ProjectMember`; coberto por testes multi-projeto e de isolamento.
- [x] **Cadastro e gestão de projetos.** CRUD de projetos, ambientes, domínios e membros.
- [x] **Isolamento de dados por projeto validado no backend.** `ProjectAccessService` valida `ProjectMember` **ATIVO**; `test/project-isolation.e2e-spec.ts` + cenários 401/403/404.
- [x] **Seleção de projeto na extensão.** Implementada na Etapa 7. *Observação: sem testes automatizados e com pendências abertas (domínio oficial e armazenamento seguro do token).*
- [x] **Sugestão de projeto por domínio, com confirmação.** `project-suggest.e2e-spec.ts` + `project-suggestion.spec.ts`; sugestão sempre corrigível manualmente.
- [x] **Registro de ocorrência e screenshot.** Núcleo de ocorrências + anexos por URL assinada; captura pela extensão. *Observação: frontend/extensão sem testes automatizados.*
- [x] **Identificação automática do autor autenticado.** O backend atribui o autor pela sessão, nunca por `userId` do cliente.
- [x] **Comentários e histórico.** Endpoints de comentários e de histórico cronológico.
- [x] **Atribuição e fluxo de status.** Responsável + transições de status controladas (`occurrence-status.e2e-spec.ts`, `occurrence-status.transitions.spec.ts`).
- [x] **Dashboard e relatórios autorizados.** Frontend e endpoints `/reports/*`. *Observação: sem E2E de navegador.*
- [x] **Auditoria.** `AuditService` + `/audit`; histórico e metadados sanitizados.
- [x] **Notificações assíncronas.** Fila BullMQ + worker; notificação não bloqueia a criação da ocorrência.
- [x] **Integração WhatsApp oficial validada ou pendência claramente documentada.** A integração **não está ativa** (sem credenciais); a pendência está documentada em [notificacoes-whatsapp.md](notificacoes-whatsapp.md) e [pendencias-conhecidas.md](pendencias-conhecidas.md).
- [x] **IA opcional com validação humana.** Provider local determinístico (sem rede), desativável e com confirmação humana ([ia-opcional.md](ia-opcional.md)).

---

## 3. Engenharia

- [x] **Typecheck.** `npm run typecheck` (TypeScript strict) + CI.
- [x] **Lint.** `npm run lint` (ESLint flat config) + CI.
- [x] **Testes unitários.** API e worker (`src/**/*.spec.ts`).
- [x] **Testes de integração.** Supertest (`apps/api/test/*.e2e-spec.ts`).
- [ ] **Testes E2E.** E2E de **navegador** (Playwright) **não implementado** — pendência. Há E2E de **API** via Supertest. Ver [relatorio-de-testes.md](relatorio-de-testes.md).
- [x] **Testes de isolamento entre projetos.** `test/project-isolation.e2e-spec.ts`.
- [x] **Testes de segurança.** `security.middleware.spec.ts` e `env.spec.ts` (além dos cenários 401/403/404 de cada suíte).
- [x] **Migrations revisadas.** Migrações versionadas em `apps/api/prisma/migrations/`. *Observação: a validação de migration/seed com Docker não foi registrada (pendência herdada da Etapa 2).*
- [x] **Backups e restauração documentados.** Runbook em [deploy-infraestrutura.md](deploy-infraestrutura.md) §8.1. *Observação: o teste de restauração ainda não foi executado (aguarda o provedor gerenciado).*
- [x] **CI funcionando.** [.github/workflows/ci.yml](../../.github/workflows/ci.yml): lint, typecheck, testes, build e build das imagens Docker.
- [ ] **Preview validado.** Nenhum ambiente provisionado / nenhum deploy executado.
- [ ] **Deploy de produção autorizado.** Produção somente após autorização explícita; **nenhum deploy realizado**.

---

## 4. Documentação

- [x] **README.** [README.md](../../README.md) — instalação, scripts e operação local.
- [x] **Arquitetura.** [arquitetura-geral.md](arquitetura-geral.md).
- [x] **C4.** [c4.md](c4.md).
- [x] **ER.** [modelo-de-dados.md](modelo-de-dados.md).
- [x] **Sitemap.** [sitemap-e-telas.md](sitemap-e-telas.md). *Observação: documento marcado como Planejado — pode não refletir 100% das telas já implementadas.*
- [x] **Diagramas de telas.** Wireframes descritivos em [sitemap-e-telas.md](sitemap-e-telas.md) §5.
- [ ] **Casos de uso.** Não há documento dedicado de diagrama de casos de uso.
- [x] **Sequência.** [arquitetura-geral.md](arquitetura-geral.md) §6, [extensao-chrome.md](extensao-chrome.md) §9 e [notificacoes-whatsapp.md](notificacoes-whatsapp.md).
- [x] **Atividades.** Ciclo de vida da ocorrência (`stateDiagram-v2`) em [modelo-de-dados.md](modelo-de-dados.md).
- [x] **Deployment.** [deploy-infraestrutura.md](deploy-infraestrutura.md).
- [x] **API OpenAPI.** Swagger gerado pelo NestJS (`/api/docs`) + artefato estático versionado em [openapi.json](../api/openapi.json) (regerado por `npm run docs:openapi`) + [contratos-api.md](contratos-api.md).
- [x] **Manual do administrador.** [manuais/administrador.md](../manuais/administrador.md).
- [x] **Manual do gestor.** [manuais/gestor.md](../manuais/gestor.md).
- [x] **Manual do testador.** [manuais/testador.md](../manuais/testador.md).
- [x] **Manual do desenvolvedor.** [manuais/desenvolvedor.md](../manuais/desenvolvedor.md).
- [x] **Guia da extensão.** [manuais/extensao-chrome.md](../manuais/extensao-chrome.md), além do documento de estratégia ([extensao-chrome.md](extensao-chrome.md)).
- [x] **Guia de instalação e operação.** [runbook-operacao.md](runbook-operacao.md) + [README.md](../../README.md).
- [x] **Guia de deploy e rollback.** [deploy-infraestrutura.md](deploy-infraestrutura.md) §8.
- [ ] **PDF consolidado.** **Adiado / pendente** — requer ferramenta de geração de PDF sem comprometer a editabilidade dos fontes Markdown (seção 17).
- [x] **Pendências e limitações registradas.** [pendencias-conhecidas.md](pendencias-conhecidas.md) + [riscos-e-dependencias.md](riscos-e-dependencias.md).

---

## 5. Resumo

| Bloco | Atendidos | Pendentes |
|---|---|---|
| Produto | 15 | 0 |
| Engenharia | 9 | 3 |
| Documentação | 18 | 2 |

> As pendências acima estão consolidadas com contexto e impacto em [pendencias-conhecidas.md](pendencias-conhecidas.md).

---

## 6. Referências

- Especificação mestra, seção 22 (CHECKLIST FINAL DE ENTREGA) e seção 17 (documentação).
- [plano-incremental.md](plano-incremental.md)
- [relatorio-de-testes.md](relatorio-de-testes.md)
- [pendencias-conhecidas.md](pendencias-conhecidas.md)
