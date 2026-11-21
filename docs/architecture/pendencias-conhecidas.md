# Pendências Conhecidas

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado

---

## 1. Objetivo

Consolidar, de forma honesta, as **pendências e limitações conhecidas** do QUALITY TEST na data desta versão — o que ainda **não** está pronto e o que depende de decisão externa. Este documento complementa [riscos-e-dependencias.md](riscos-e-dependencias.md) (riscos e custos) e [checklist-de-aceite.md](checklist-de-aceite.md) (estado item a item).

> Nada aqui deve ser interpretado como "em produção". Nenhum deploy foi executado e várias dependências seguem **PENDENTE DE DEFINIÇÃO**.

---

## 2. Pendências de produto e integração

| # | Pendência | Estado | Detalhe |
|---|---|---|---|
| P1 | **WhatsApp oficial: integração pronta, credenciais pendentes** | PENDENTE DE DEFINIÇÃO (código pronto) | A integração com a WhatsApp Business Platform / Cloud API oficial está **implementada**; permanece **DESATIVADA por padrão** até haver `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_CLOUD_API_TOKEN`. Sem credenciais o canal é inerte e a fila de notificações opera normalmente. Ver [notificacoes-whatsapp.md](notificacoes-whatsapp.md). |
| P2 | **Domínio oficial da extensão** | PENDENTE DE DEFINIÇÃO (token resolvido) | O build já aceita o domínio oficial via `QUALITYTEST_API_BASE_URL` (`host_permissions` derivado automaticamente) e o token passou a ser guardado em `chrome.storage.session` (memória volátil, limpa ao fechar o navegador). Falta apenas definir o domínio oficial. Ver [extensao-chrome.md](extensao-chrome.md). |
| P3 | **Provedor externo de IA: adaptador pronto, credenciais pendentes** | PENDENTE DE DEFINIÇÃO (código pronto) | O adaptador externo (compatível com OpenAI) está **implementado** e é plugável via `AI_PROVIDER=external`; falta definir o provedor concreto e fornecer credenciais. Por padrão o módulo permanece desativado. Ver [ia-opcional.md](ia-opcional.md). |

---

## 3. Pendências de qualidade e testes

| # | Pendência | Estado | Detalhe |
|---|---|---|---|
| P4 | **E2E de navegador (Playwright)** | RESOLVIDO (21/11/2026) | Suíte Playwright em `e2e/` cobrindo o frontend (`web`) e a extensão (`extension`, carregada via `launchPersistentContext`). Execução: `npm run test:e2e`. Ver [relatorio-de-testes.md](relatorio-de-testes.md). |
| P5 | **Metas de cobertura** | RESOLVIDO (21/11/2026) | `coverageThreshold` definido em API, worker e extensão; `npm test` coleta cobertura e falha abaixo da meta. Ver [plano-de-testes.md](plano-de-testes.md). |
| P6 | **Validação de migration/seed com Docker** | PENDENTE | Pendência herdada da Etapa 2: migrações existem, mas a validação completa com Docker não foi registrada. |

---

## 4. Pendências de segurança, LGPD e operação

| # | Pendência | Estado | Detalhe |
|---|---|---|---|
| P7 | **Política de retenção e descarte (LGPD)** | PENDENTE DE DEFINIÇÃO | Política formal de retenção/descarte e processo de atendimento a solicitações de titulares dependem da área de negócio/compliance. Ver [seguranca-lgpd.md](seguranca-lgpd.md). |
| P8 | **Teste de restauração de backup** | PENDENTE | Procedimento documentado; a **execução** aguarda o provedor de PostgreSQL gerenciado (ainda não definido). Ver [deploy-infraestrutura.md](deploy-infraestrutura.md) §8.1. |
| P9 | **Imutabilidade da auditoria em nível de banco** | RESOLVIDO (21/11/2026) | Trigger PostgreSQL (`qualitytest_block_audit_mutation`) bloqueia UPDATE/DELETE/TRUNCATE em `audit_logs`; migration `20261121010000_audit_logs_immutable`. Ver [modelo-de-dados.md](modelo-de-dados.md). |

---

## 5. Dependências técnicas

| # | Pendência | Estado | Detalhe |
|---|---|---|---|
| P10 | **Dependências com breaking change (`zod@4`, `next@16`)** | PENDENTE | `npm audit` (21/11/2026) aponta vulnerabilidades altas cuja correção exige upgrade com breaking change (`zod@4`, `next@16`); a atualização deve ser tratada como tarefa própria com validação completa (typecheck, testes, build). Ver [seguranca-lgpd.md](seguranca-lgpd.md) §5. |

---

## 6. Pendências de definição de infraestrutura

| # | Pendência | Estado | Detalhe |
|---|---|---|---|
| P11 | **Provedores gerenciados não definidos** | PENDENTE DE DEFINIÇÃO | PostgreSQL, Redis e storage S3-compatível: provedores e capacidade a definir. Ver [deploy-infraestrutura.md](deploy-infraestrutura.md) §10. |
| P12 | **Domínio e HTTPS** | PENDENTE DE DEFINIÇÃO | Domínio oficial e configuração de HTTPS a definir quando fornecido. |
| P13 | **Registry de imagens Docker** | RESOLVIDO (padrão GHCR) | Publicação pelo workflow `release.yml` no GHCR via `GITHUB_TOKEN` (sem credenciais externas). Trocar apenas se houver exigência corporativa por outro registro. Ver [deploy-infraestrutura.md](deploy-infraestrutura.md) §6.3. |
| P14 | **Observabilidade / logs** | PENDENTE DE DEFINIÇÃO | Solução de monitoramento e logs a definir (hoje API e worker registram em `stdout`/`stderr`). |

---

## 7. Pendências de documentação

| # | Pendência | Estado | Detalhe |
|---|---|---|---|
| P15 | **PDF consolidado** | ADIADO / PENDENTE | Requer ferramenta de geração de PDF sem comprometer a editabilidade dos fontes Markdown (seção 17). Ver [checklist-de-aceite.md](checklist-de-aceite.md). |
| P16 | **Manuais de uso por perfil** | RESOLVIDO (21/11/2026) | Produzidos: [manuais/administrador.md](../manuais/administrador.md), [gestor.md](../manuais/gestor.md), [testador.md](../manuais/testador.md) e [desenvolvedor.md](../manuais/desenvolvedor.md). |
| P17 | **Guia de instalação/uso da extensão** | RESOLVIDO (21/11/2026) | [manuais/extensao-chrome.md](../manuais/extensao-chrome.md). |
| P18 | **Diagrama de casos de uso** | RESOLVIDO (21/11/2026) | [casos-de-uso.md](casos-de-uso.md) — diagrama de casos de uso (Mermaid), atores, relacionamentos `include`/`extend` e rastreabilidade (item da seção 17.2). |

> Observação: `docs/api/openapi.json` passou a ser versionado (seção 17.3 / ETAPA 12) e é regenerado por `npm run docs:openapi`; deve ser atualizado sempre que os contratos mudarem.

---

## 8. Referências

- [riscos-e-dependencias.md](riscos-e-dependencias.md)
- [checklist-de-aceite.md](checklist-de-aceite.md)
- [seguranca-lgpd.md](seguranca-lgpd.md)
- [deploy-infraestrutura.md](deploy-infraestrutura.md)
- [plano-incremental.md](plano-incremental.md)
