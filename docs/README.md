# QUALITY TEST — Índice Geral da Documentação

**Versão:** 2.0
**Data:** 21/11/2026
**Status:** Em execução (Etapas 1 a 10 concluídas; Etapa 11 — Deploy em preparação; Etapa 12 — Documentação e Entrega concluída, exceto o PDF consolidado)

---

## 1. Sobre este documento

Este é o índice central da documentação do projeto **QUALITY TEST**, plataforma corporativa de gestão de testes, registro de defeitos e acompanhamento de homologação.

A documentação descreve o sistema **realmente implementado**, com itens que dependem de decisão externa explicitamente marcados como **PENDENTE DE DEFINIÇÃO**. Planejamento histórico permanece identificado como tal.

**Repositório oficial:** https://github.com/alexsandrosodre/qualitytest.git
**Especificação mestra:** `Quality_Test_Especificacao_Mestre_GitHub_Vercel_v4.txt` (versão 4.0, data 20/11/2026)

> Situação atual: **Etapas 1 a 10 concluídas**; **Etapa 11 — Deploy em preparação** (artefatos de build versionados; **nenhum deploy de produção executado**); **Etapa 12 — Documentação e Entrega concluída**, com o **PDF consolidado adiado**. Sequência e critérios em [plano-incremental.md](architecture/plano-incremental.md).

---

## 2. Legenda de status

| Status | Significado |
|---|---|
| **Implementado** | Item efetivamente codificado e validado no repositório. |
| **Em preparação / Em andamento** | Iniciado, porém ainda não concluído. |
| **Revisado** | Documento de acompanhamento atualizado para o estado real. |
| **Registro histórico** | Evidência de um estado passado; não é atualizado. |
| **PENDENTE DE DEFINIÇÃO** | Depende de decisão, credenciais, aprovação ou informação externa. |
| **PENDENTE / ADIADO** | Trabalho conhecido e não concluído, registrado em [pendencias-conhecidas.md](architecture/pendencias-conhecidas.md). |

---

## 3. Índice de documentos

### 3.1 Visão geral e diagnóstico

| Documento | Descrição | Status |
|---|---|---|
| [architecture/diagnostico.md](architecture/diagnostico.md) | Diagnóstico do repositório e do ambiente (ETAPA 1) | Registro histórico |
| [architecture/arquitetura-geral.md](architecture/arquitetura-geral.md) | Visão geral da arquitetura, princípios, stack e estrutura de diretórios | Implementado |
| [architecture/c4.md](architecture/c4.md) | Diagramas C4: Contexto, Containers e Componentes | Implementado |

### 3.2 Modelo e regras

| Documento | Descrição | Status |
|---|---|---|
| [architecture/modelo-de-dados.md](architecture/modelo-de-dados.md) | Modelo ER e regras de integridade (Prisma + migrações) | Implementado |
| [architecture/permissoes-e-isolamento.md](architecture/permissoes-e-isolamento.md) | RBAC, matriz de permissões e isolamento por projeto | Implementado |

### 3.3 Integrações e interfaces

| Documento | Descrição | Status |
|---|---|---|
| [architecture/contratos-api.md](architecture/contratos-api.md) | Contratos da API REST | Implementado |
| [api/openapi.json](api/openapi.json) | Documento OpenAPI gerado (`npm run docs:openapi`); Swagger em `/api/docs` | Implementado |
| [architecture/extensao-chrome.md](architecture/extensao-chrome.md) | Estratégia da extensão Chrome (Manifest V3) | Implementado (Etapa 7; pendências na seção 11) |
| [architecture/notificacoes-whatsapp.md](architecture/notificacoes-whatsapp.md) | Serviço desacoplado de notificações e limitações do WhatsApp | Implementado (canal WhatsApp desativado) |
| [architecture/ia-opcional.md](architecture/ia-opcional.md) | Módulo opcional de IA assistiva (desativável) | Implementado |

### 3.4 Entrega, qualidade e operação

| Documento | Descrição | Status |
|---|---|---|
| [architecture/relatorio-de-testes.md](architecture/relatorio-de-testes.md) | Resultados reais dos testes (API, worker, frontend e extensão) | Implementado |
| [architecture/checklist-de-aceite.md](architecture/checklist-de-aceite.md) | Checklist final de entrega (seção 22), item a item | Implementado |
| [architecture/pendencias-conhecidas.md](architecture/pendencias-conhecidas.md) | Pendências e limitações conhecidas (P1–P18) | Implementado |
| [architecture/runbook-operacao.md](architecture/runbook-operacao.md) | Instalação, operação, migrações, backup e troubleshooting | Implementado |

### 3.5 Infraestrutura e planejamento

| Documento | Descrição | Status |
|---|---|---|
| [architecture/deploy-infraestrutura.md](architecture/deploy-infraestrutura.md) | Deploy, ambientes, CI/CD, runbooks e rollback | Preparação implementada — deploy **não executado** |
| [architecture/seguranca-lgpd.md](architecture/seguranca-lgpd.md) | Revisão de segurança, headers, secrets, anexos e LGPD | Implementado (revisão da ETAPA 10) |
| [architecture/plano-de-testes.md](architecture/plano-de-testes.md) | Estratégia de testes e critérios de aceite | Implementado (estratégia executada) |
| [architecture/sitemap-e-telas.md](architecture/sitemap-e-telas.md) | Sitemap, navegação, telas e matriz por perfil | Implementado na Etapa 6 (pendência: E2E de navegador) |
| [architecture/riscos-e-dependencias.md](architecture/riscos-e-dependencias.md) | Riscos, custos e dependências externas | Revisado |
| [architecture/plano-incremental.md](architecture/plano-incremental.md) | As 12 etapas do plano de execução | Etapas 1 a 10 concluídas; 11 em preparação; 12 concluída (exceto PDF) |

### 3.6 Manuais de uso (seção 17.4)

| Documento | Descrição | Status |
|---|---|---|
| [manuais/administrador.md](manuais/administrador.md) | Manual do administrador | Implementado |
| [manuais/gestor.md](manuais/gestor.md) | Manual do gestor | Implementado |
| [manuais/testador.md](manuais/testador.md) | Manual do testador | Implementado |
| [manuais/desenvolvedor.md](manuais/desenvolvedor.md) | Manual do desenvolvedor | Implementado |
| [manuais/extensao-chrome.md](manuais/extensao-chrome.md) | Instalação e uso da extensão Chrome | Implementado |

### 3.7 Decisões arquiteturais (ADRs)

| Documento | Descrição | Status |
|---|---|---|
| [architecture/adr/ADR-0001-stack-e-monorepo.md](architecture/adr/ADR-0001-stack-e-monorepo.md) | Stack tecnológica e monorepositório | Aceito |
| [architecture/adr/ADR-0002-isolamento-por-projeto.md](architecture/adr/ADR-0002-isolamento-por-projeto.md) | Isolamento lógico por projeto | Aceito |
| [architecture/adr/ADR-0003-autenticacao-e-sessoes.md](architecture/adr/ADR-0003-autenticacao-e-sessoes.md) | Autenticação própria e sessões | Aceito |

---

## 4. Resumo executivo do produto

O QUALITY TEST centraliza o registro e o acompanhamento de testes, bugs, inconsistências e problemas identificados durante a homologação dos sistemas da empresa. O objetivo é substituir a dispersão atual de informações em grupos de WhatsApp por uma base única organizada por projeto, usuário, equipe, ambiente, prioridade e status.

**Princípios centrais:**

1. **Multi-projeto com isolamento lógico** — cada ocorrência pertence a um projeto e não pode vazar para usuários sem autorização naquele projeto.
2. **Usuário único, múltiplos projetos** — uma mesma conta participa de vários projetos via associação explícita (`ProjectMember`), sem contas duplicadas.
3. **Autor identificado pelo servidor** — a autoria é atribuída a partir da sessão autenticada, nunca de um `userId` enviado livremente pelo cliente.
4. **WhatsApp e IA são módulos desacoplados** — a indisponibilidade de qualquer um deles não pode impedir o cadastro, a consulta ou o ciclo de vida da ocorrência.
5. **Rastreabilidade completa** — histórico e auditoria de todas as ações relevantes.

O estado de entrega item a item está em [checklist-de-aceite.md](architecture/checklist-de-aceite.md); os resultados de teste em [relatorio-de-testes.md](architecture/relatorio-de-testes.md).

---

## 5. Como manter esta documentação

- Diagramas Mermaid devem ser **editáveis** (código-fonte no Markdown) e refletir o sistema **realmente implementado**.
- Não documentar funcionalidades inexistentes como concluídas.
- Ao alterar contratos, telas ou modelo de dados, atualizar os documentos correspondentes, regerar [api/openapi.json](api/openapi.json) (`npm run docs:openapi`) e revisar a versão/data de cada arquivo.
- Itens que dependem de decisão externa devem ser explicitamente marcados como **PENDENTE DE DEFINIÇÃO**.

---

## 6. Itens pendentes de definição (consolidado)

Os pontos abaixo ainda dependem de decisão ou informação externa. Consolidação completa e acionável (P1–P18) em [pendencias-conhecidas.md](architecture/pendencias-conhecidas.md); detalhamento de riscos em [riscos-e-dependencias.md](architecture/riscos-e-dependencias.md).

- Domínio oficial e configuração de HTTPS — PENDENTE DE DEFINIÇÃO
- Conta/projeto na Vercel e demais credenciais de deploy — PENDENTE DE DEFINIÇÃO
- Credenciais oficiais da WhatsApp Business Platform / Cloud API (Meta) — PENDENTE DE DEFINIÇÃO
- Provedor de PostgreSQL gerenciado — PENDENTE DE DEFINIÇÃO
- Provedor de Redis gerenciado — PENDENTE DE DEFINIÇÃO
- Provedor de storage S3-compatível — PENDENTE DE DEFINIÇÃO
- Registry de imagens Docker — PENDENTE DE DEFINIÇÃO
- Observabilidade / logs centralizados — PENDENTE DE DEFINIÇÃO
- Provedor de IA (opcional) e base legal de tratamento — PENDENTE DE DEFINIÇÃO
- Política de retenção e descarte (LGPD) — PENDENTE DE DEFINIÇÃO
- Metas de cobertura de testes e E2E de navegador — PENDENTE
- PDF consolidado da documentação — ADIADO
- Custos estimados por serviço — a levantar
