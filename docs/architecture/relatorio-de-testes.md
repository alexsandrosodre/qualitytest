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
| `npm test` | Testes de todos os workspaces que possuem script `test` (`api`, `worker` e `extension`), **com coleta de cobertura** |
| `npm run test:e2e` | E2E de navegador (Playwright) — compila a extensão e executa os projetos `web` e `extension` |
| `npm run test:e2e:install` | Instala o navegador Chromium do Playwright (`--with-deps`) |
| `npm run test:e2e:report` | Abre o relatório HTML do Playwright |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces |
| `npm run lint` | ESLint (flat config) em todo o monorepo |
| `npm run build` | Build de `shared` → `api` → `worker` → `web` → `extension` |

Os mesmos passos são executados no CI ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)): `lint` → `typecheck` → `test` → `build` a cada push/pull request para `main`.

---

## 3. Tipos de teste implementados

| Tipo | Ferramenta | Onde |
|---|---|---|
| **Unitário** | Jest | `apps/*/src/**/*.spec.ts(x)` |
| **Integração / E2E de API** | Jest + Supertest | `apps/api/test/*.e2e-spec.ts` |
| **Isolamento entre projetos** | Jest + Supertest | `apps/api/test/project-isolation.e2e-spec.ts` |
| **Segurança** | Jest | `apps/api/src/common/security/security.middleware.spec.ts`, `apps/api/src/common/config/env.spec.ts` |
| **E2E de navegador (web)** | Playwright | `e2e/web/*.spec.ts` |
| **E2E da extensão (MV3)** | Playwright | `e2e/extension/*.spec.ts` |

---

## 4. Resultados atuais (21/11/2026)

| Workspace | Suítes | Testes | Situação |
|---|---|---|---|
| **API** (`apps/api`) | 22 | 201 | Aprovados |
| **Worker** (`apps/worker`) | 2 | 17 | Aprovados |
| **Extensão** (`apps/extension`) | 1 | 6 | Aprovados |
| **Frontend** (`apps/web`) | 0 | 0 | Sem unitários (coberto por E2E `web`) |
| **E2E navegador** (`e2e/`) | 4 | 4 | Aprovados (2 web + 2 extensão) |

> Os totais refletem a execução vigente do repositório. A API concentra testes unitários (regras de negócio, tokens, senha, transições de status, sugestão de projeto, IA local, configuração de ambiente e headers de segurança) e testes de integração/E2E via Supertest. O worker cobre canais, configuração e processamento; a extensão cobre o módulo de sessão (token seguro).

### 4.1 Cobertura medida

| Workspace | Statements | Branches | Functions | Lines | Meta (stmts) |
|---|---|---|---|---|---|
| **API** | 83.99% | 60.39% | 79.29% | 83.31% | 80% |
| **Worker** | 89.31% | 70.37% | 85% | 89.84% | 85% |
| **Extensão** | 100% | 86.66% | 100% | 100% | 90% |

> As metas (`coverageThreshold`) são verificadas a cada `npm test`; ver [plano-de-testes.md](plano-de-testes.md) §6.1.

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

- **Sem unitários no frontend (`apps/web`)** — o app web ainda não possui testes unitários; os fluxos críticos começam a ser cobertos por E2E de navegador (Playwright).
- **E2E de navegador com cobertura inicial** — a suíte Playwright cobre login (web) e o popup/sessão da extensão; fluxos completos (registro de ocorrência, homologação, isolamento pela UI) ainda não estão automatizados.
- **Teste de restauração de backup não executado** — procedimento documentado, execução aguarda o provedor de PostgreSQL gerenciado ([deploy-infraestrutura.md](deploy-infraestrutura.md) §8.1).

---

## 7. Referências

- [plano-de-testes.md](plano-de-testes.md)
- [seguranca-lgpd.md](seguranca-lgpd.md)
- [deploy-infraestrutura.md](deploy-infraestrutura.md)
- [pendencias-conhecidas.md](pendencias-conhecidas.md)
- [README.md](../../README.md)
