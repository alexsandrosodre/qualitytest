# QUALITY TEST — Índice Geral da Documentação

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Planejado (não implementado)

---

## 1. Sobre este documento

Este é o índice central da documentação do projeto **QUALITY TEST**, plataforma corporativa de gestão de testes, registro de defeitos e acompanhamento de homologação.

Toda a documentação aqui descrita é **Planejado / Proposto**. Nada foi implementado no repositório oficial até a data desta versão. Os documentos descrevem a arquitetura alvo, os contratos propostos e o plano de execução, e não devem ser interpretados como registro de funcionalidades concluídas.

**Repositório oficial:** https://github.com/alexsandrosodre/qualitytest.git
**Especificação mestra:** `Quality_Test_Especificacao_Mestre_GitHub_Vercel_v4.txt` (versão 4.0, data 20/11/2026)

> Situação atual: o projeto encontra-se na **ETAPA 1 — DIAGNÓSTICO E ARQUITETURA** do plano de execução (ver [plano-incremental.md](architecture/plano-incremental.md)). O repositório remoto está vazio e o ambiente local contém apenas o arquivo de especificação.

---

## 2. Legenda de status

| Status | Significado |
|---|---|
| **Planejado** | Documento proposto/criado. Descreve algo que ainda **não existe** no código. |
| **Em andamento** | Item cuja execução foi iniciada, mas ainda não concluída. |
| **Implementado** | Item efetivamente codificado e validado. |
| **Pendente de definição** | Depende de decisão externa, credenciais, aprovação ou informação ainda não disponível. |

> Observação: nesta versão **não há nenhum item "Implementado"**. Todos os documentos e seções estão em estado **Planejado** ou **Pendente de definição**.

---

## 3. Índice de documentos

### 3.1 Visão geral e diagnóstico

| Documento | Descrição | Status |
|---|---|---|
| [architecture/diagnostico.md](architecture/diagnostico.md) | Diagnóstico do repositório e do ambiente | Planejado |
| [architecture/arquitetura-geral.md](architecture/arquitetura-geral.md) | Visão geral da arquitetura, princípios, stack e estrutura de diretórios | Planejado |
| [architecture/c4.md](architecture/c4.md) | Diagramas C4: Contexto, Containers e Componentes | Planejado |

### 3.2 Modelo e regras

| Documento | Descrição | Status |
|---|---|---|
| [architecture/modelo-de-dados.md](architecture/modelo-de-dados.md) | Modelo ER completo e regras de integridade | Planejado |
| [architecture/permissoes-e-isolamento.md](architecture/permissoes-e-isolamento.md) | RBAC, matriz de permissões e isolamento por projeto | Planejado |

### 3.3 Integrações e interfaces

| Documento | Descrição | Status |
|---|---|---|
| [architecture/contratos-api.md](architecture/contratos-api.md) | Contratos da API REST | Planejado |
| [architecture/extensao-chrome.md](architecture/extensao-chrome.md) | Estratégia da extensão Chrome (Manifest V3) | Planejado |
| [architecture/notificacoes-whatsapp.md](architecture/notificacoes-whatsapp.md) | Serviço desacoplado de notificações e limitações do WhatsApp | Planejado |
| [architecture/ia-opcional.md](architecture/ia-opcional.md) | Módulo opcional de IA assistiva (desativável) | Implementado |

### 3.4 Infraestrutura, qualidade e planejamento

| Documento | Descrição | Status |
|---|---|---|
| [architecture/deploy-infraestrutura.md](architecture/deploy-infraestrutura.md) | Deploy, ambientes, CI/CD e infraestrutura | Implementado (preparação; deploy não executado) |
| [architecture/seguranca-lgpd.md](architecture/seguranca-lgpd.md) | Revisão de segurança, headers, secrets, anexos e LGPD | Implementado |
| [architecture/plano-de-testes.md](architecture/plano-de-testes.md) | Plano de testes e critérios de aceite | Planejado |
| [architecture/sitemap-e-telas.md](architecture/sitemap-e-telas.md) | Sitemap, navegação, telas e matriz por perfil | Planejado |
| [architecture/riscos-e-dependencias.md](architecture/riscos-e-dependencias.md) | Riscos, custos e dependências externas | Planejado |
| [architecture/plano-incremental.md](architecture/plano-incremental.md) | As 12 etapas do plano de execução | Concluídas (Etapas 1 a 10); Etapa 11 em preparação |

### 3.5 Decisões arquiteturais (ADRs)

| Documento | Descrição | Status |
|---|---|---|
| [architecture/adr/ADR-0001-stack-e-monorepo.md](architecture/adr/ADR-0001-stack-e-monorepo.md) | Stack tecnológica e monorepositório | Proposto |
| [architecture/adr/ADR-0002-isolamento-por-projeto.md](architecture/adr/ADR-0002-isolamento-por-projeto.md) | Isolamento lógico por projeto | Proposto |
| [architecture/adr/ADR-0003-autenticacao-e-sessoes.md](architecture/adr/ADR-0003-autenticacao-e-sessoes.md) | Autenticação própria e sessões | Proposto |

---

## 4. Resumo executivo do produto

O QUALITY TEST centraliza o registro e o acompanhamento de testes, bugs, inconsistências e problemas identificados durante a homologação dos sistemas da empresa. O objetivo é substituir a dispersão atual de informações em grupos de WhatsApp por uma base única organizada por projeto, usuário, equipe, ambiente, prioridade e status.

**Princípios centrais:**

1. **Multi-projeto com isolamento lógico** — cada ocorrência pertence a um projeto e não pode vazar para usuários sem autorização naquele projeto.
2. **Usuário único, múltiplos projetos** — uma mesma conta participa de vários projetos via associação explícita (`ProjectMember`), sem contas duplicadas.
3. **Autor identificado pelo servidor** — a autoria é atribuída a partir da sessão autenticada, nunca de um `userId` enviado livremente pelo cliente.
4. **WhatsApp e IA são módulos desacoplados** — a indisponibilidade de qualquer um deles não pode impedir o cadastro, a consulta ou o ciclo de vida da ocorrência.
5. **Rastreabilidade completa** — histórico e auditoria de todas as ações relevantes.

O escopo detalhado do MVP consta em [architecture/plano-de-testes.md](architecture/plano-de-testes.md) (critérios de aceite) e a sequência de entrega em [architecture/plano-incremental.md](architecture/plano-incremental.md).

---

## 5. Como manter esta documentação

- Diagramas Mermaid devem ser **editáveis** (código-fonte no Markdown) e refletir o sistema **realmente implementado**.
- Não documentar funcionalidades inexistentes como concluídas.
- Ao alterar contratos, telas ou modelo de dados, atualizar os documentos correspondentes e revisar a versão/data de cada arquivo.
- Itens que dependem de decisão externa devem ser explicitamente marcados como **PENDENTE DE DEFINIÇÃO**.

---

## 6. Itens pendentes de definição (consolidado)

Os pontos abaixo ainda dependem de decisão ou informação externa. Detalhamento em [architecture/riscos-e-dependencias.md](architecture/riscos-e-dependencias.md).

- Domínio oficial e configuração de HTTPS — PENDENTE DE DEFINIÇÃO
- Conta/projeto na Vercel e demais credenciais de deploy — PENDENTE DE DEFINIÇÃO
- Credenciais oficiais da WhatsApp Business Platform / Cloud API (Meta) — PENDENTE DE DEFINIÇÃO
- Provedor de PostgreSQL gerenciado — PENDENTE DE DEFINIÇÃO
- Provedor de Redis gerenciado — PENDENTE DE DEFINIÇÃO
- Provedor de storage S3-compatível — PENDENTE DE DEFINIÇÃO
- Provedor de IA (opcional) e base legal de tratamento — PENDENTE DE DEFINIÇÃO
- Custos estimados por serviço — a levantar
