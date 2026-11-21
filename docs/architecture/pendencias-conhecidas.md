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
| P1 | **WhatsApp oficial sem credenciais (canal desativado)** | PENDENTE DE DEFINIÇÃO | A integração com a WhatsApp Business Platform / Cloud API oficial não está ativa por ausência de elegibilidade/credenciais. O canal é desacoplado e desativável; a fila de notificações opera sem ele. Ver [notificacoes-whatsapp.md](notificacoes-whatsapp.md). |
| P2 | **Domínio oficial da extensão e armazenamento seguro do token** | PENDENTE DE DEFINIÇÃO | Falta definir o domínio oficial e o mecanismo de armazenamento seguro do token na extensão Chrome. Ver [extensao-chrome.md](extensao-chrome.md). |
| P3 | **Provedor externo de IA não conectado** | PENDENTE DE DEFINIÇÃO | O contrato prevê provider externo, mas apenas o provider local determinístico (sem rede) está implementado. Ver [ia-opcional.md](ia-opcional.md). |

---

## 3. Pendências de qualidade e testes

| # | Pendência | Estado | Detalhe |
|---|---|---|---|
| P4 | **E2E de navegador (Playwright)** | PENDENTE | Não há testes de ponta a ponta no navegador. Existe apenas E2E de API via Supertest. Frontend (`apps/web`) e extensão (`apps/extension`) **não** possuem testes automatizados. Ver [relatorio-de-testes.md](relatorio-de-testes.md). |
| P5 | **Metas de cobertura** | PENDENTE DE DEFINIÇÃO | Percentual mínimo e relatório de cobertura não definidos. Ver [plano-de-testes.md](plano-de-testes.md). |
| P6 | **Validação de migration/seed com Docker** | PENDENTE | Pendência herdada da Etapa 2: migrações existem, mas a validação completa com Docker não foi registrada. |

---

## 4. Pendências de segurança, LGPD e operação

| # | Pendência | Estado | Detalhe |
|---|---|---|---|
| P7 | **Política de retenção e descarte (LGPD)** | PENDENTE DE DEFINIÇÃO | Política formal de retenção/descarte e processo de atendimento a solicitações de titulares dependem da área de negócio/compliance. Ver [seguranca-lgpd.md](seguranca-lgpd.md). |
| P8 | **Teste de restauração de backup** | PENDENTE | Procedimento documentado; a **execução** aguarda o provedor de PostgreSQL gerenciado (ainda não definido). Ver [deploy-infraestrutura.md](deploy-infraestrutura.md) §8.1. |
| P9 | **Imutabilidade da auditoria em nível de banco** | PENDENTE | Hoje garantida na aplicação (sem endpoints de edição/remoção); falta trigger/RLS no banco. |

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
| P18 | **Diagrama de casos de uso** | PENDENTE | Não há documento dedicado de casos de uso (item da seção 17.2). Ver [checklist-de-aceite.md](checklist-de-aceite.md). |

> Observação: `docs/api/openapi.json` passou a ser versionado (seção 17.3 / ETAPA 12) e é regenerado por `npm run docs:openapi`; deve ser atualizado sempre que os contratos mudarem.

---

## 8. Referências

- [riscos-e-dependencias.md](riscos-e-dependencias.md)
- [checklist-de-aceite.md](checklist-de-aceite.md)
- [seguranca-lgpd.md](seguranca-lgpd.md)
- [deploy-infraestrutura.md](deploy-infraestrutura.md)
- [plano-incremental.md](plano-incremental.md)
