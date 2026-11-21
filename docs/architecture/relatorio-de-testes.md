# Relatório de Testes

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado

---

## 1. Objetivo

Registrar o **estado real da execução de testes** do QUALITY TEST na data desta versão. O documento descreve os tipos de teste existentes, como executá-los, os resultados atuais, o que está coberto e as **lacunas conhecidas**.

> Este relatório documenta **apenas** o que existe e foi executado no código atual. Números de cobertura, metas e cenários planejados estão em [plano-de-testes.md](plano-de-testes.md).

---

## 2. Como executar

Os scripts são definidos na raiz do monorepo (`package.json`):

| Comando | O que executa |
|---|---|
| `npm test` | Testes de todos os workspaces que possuem script `test` (hoje: `api` e `worker`) |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces |
| `npm run lint` | ESLint (flat config) em todo o monorepo |
| `npm run build` | Build de `shared` → `api` → `worker` → `web` → `extension` |

Os mesmos passos são executados no CI ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)): `lint` → `typecheck` → `test` → `build` a cada push/pull request para `main`.

---

## 3. Tipos de teste implementados

| Tipo | Ferramenta | Onde |
|---|---|---|
| **Unitário** | Jest | `apps/*/src/**/*.spec.ts` |
| **Integração / E2E de API** | Jest + Supertest | `apps/api/test/*.e2e-spec.ts` |
| **Isolamento entre projetos** | Jest + Supertest | `apps/api/test/project-isolation.e2e-spec.ts` |
| **Segurança** | Jest | `apps/api/src/common/security/security.middleware.spec.ts`, `apps/api/src/common/config/env.spec.ts` |

---

## 4. Resultados atuais (21/11/2026)

| Workspace | Suítes | Testes | Situação |
|---|---|---|---|
| **API** (`apps/api`) | 20 | 191 | Aprovados |
| **Worker** (`apps/worker`) | 1 | 9 | Aprovados |
| **Frontend** (`apps/web`) | 0 | 0 | **Sem testes automatizados** |
| **Extensão** (`apps/extension`) | 0 | 0 | **Sem testes automatizados** |

> Os totais acima refletem a execução vigente do repositório. A API concentra testes unitários (regras de negócio, tokens, senha, transições de status, sugestão de projeto, IA local, configuração de ambiente e headers de segurança) e testes de integração/E2E via Supertest.

---

## 5. Cobertura funcional (o que é coberto)

- **Autenticação**: login, refresh (rotação), logout, `me`, redefinição/troca de senha.
- **Usuários**: gestão por administrador, perfil próprio, ativação/desativação.
- **Projetos**: CRUD, ambientes, domínios e membros.
- **Vínculos e isolamento**: `ProjectMember` como fonte de autorização; cenários negativos de 401/403/404; teste dedicado de isolamento entre projetos.
- **Ocorrências**: criação idempotente (`Idempotency-Key`), listagem com isolamento, detalhe, edição, responsável, fluxo de status, histórico e comentários.
- **Anexos**: solicitação de upload por URL assinada, listagem, download e remoção, com validação de MIME/extensão/tamanho.
- **Notificações**: fila assíncrona, worker (retentativas/backoff, DLQ `notifications-dlq`) e endpoints de notificação.
- **IA (opcional)**: provider local determinístico (sem rede) com validação humana.
- **Segurança**: headers via `helmet`, força mínima de `JWT_SECRET`, CORS com whitelist e validação de anexos.

---

## 6. Lacunas conhecidas

- **Sem E2E de navegador (Playwright).** Os fluxos de ponta a ponta no navegador (login, telas, dashboard, extensão) **não** possuem testes automatizados. Há apenas E2E de **API** via Supertest. Ver [pendencias-conhecidas.md](pendencias-conhecidas.md).
- **Sem testes no frontend (`apps/web`) e na extensão (`apps/extension`).**
- **Sem metas de cobertura definidas** (percentual mínimo e relatório de cobertura ainda **PENDENTE DE DEFINIÇÃO**, conforme [plano-de-testes.md](plano-de-testes.md)).
- **Teste de restauração de backup não executado** — procedimento documentado, execução aguarda o provedor de PostgreSQL gerenciado ([deploy-infraestrutura.md](deploy-infraestrutura.md) §8.1).

---

## 7. Referências

- [plano-de-testes.md](plano-de-testes.md)
- [seguranca-lgpd.md](seguranca-lgpd.md)
- [deploy-infraestrutura.md](deploy-infraestrutura.md)
- [pendencias-conhecidas.md](pendencias-conhecidas.md)
- [README.md](../../README.md)
