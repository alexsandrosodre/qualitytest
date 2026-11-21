# Segurança e LGPD

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado (revisão da ETAPA 10)

---

## 1. Objetivo

Registrar a **revisão de segurança e qualidade** do QUALITY TEST, fiel à **seção 14** da especificação mestra, mapeando cada requisito ao estado real da implementação e listando os endurecimentos aplicados e as pendências conhecidas.

> Escopo desta revisão: **ETAPA 10 — Segurança e Qualidade** (testes completos, revisão de autorização, revisão de upload, revisão de secrets, testes de recuperação e correções).

---

## 2. Checklist da seção 14

| # | Requisito | Estado | Evidência / Observação |
|---|---|---|---|
| 1 | RBAC e autorização por projeto | Implementado | `GlobalRolesGuard`; `ProjectAccessService.resolveMembership` como fonte única ([permissoes-e-isolamento.md](permissoes-e-isolamento.md)) |
| 2 | Hash de senha com algoritmo apropriado | Implementado | `argon2id` (m=19456, t=2, p=1) em `common/password` |
| 3 | Sessões e refresh tokens protegidos | Implementado | Access JWT curto (15m); refresh **opaco** com hash SHA-256 em repouso, **rotação** e revogação (`common/tokens`) |
| 4 | Validação de entrada | Implementado | `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`); DTOs `class-validator` em todas as rotas |
| 5 | Proteção contra SQL Injection | Implementado | Acesso exclusivamente via Prisma ORM; único `$queryRaw` é `SELECT 1` fixo (health) |
| 6 | Proteção contra XSS | Implementado | API retorna JSON; frontend React (escape automático); **sem** `dangerouslySetInnerHTML`/`eval` |
| 7 | Proteção contra CSRF | Mitigado por arquitetura | Autenticação por `Authorization: Bearer` (token em `localStorage`), **sem** cookie de sessão — não há credencial ambiente a ser explorada por CSRF |
| 8 | CORS restrito | Implementado | Whitelist via `CORS_ORIGIN` (CSV); nunca wildcard com `credentials` |
| 9 | Rate limiting | Implementado | `ThrottlerGuard` global + limites específicos em `login`/`refresh`/`forgot`/`reset` |
| 10 | Headers de segurança | **Implementado (ETAPA 10)** | `helmet` em `common/security/security.middleware.ts` (ver seção 3) |
| 11 | HTTPS | Pendente (infra) | Responsabilidade do ambiente ([deploy-infraestrutura.md](deploy-infraestrutura.md)) |
| 12 | Controle de acesso a anexos | Implementado | Download exige vínculo com o projeto; entrega por URL assinada com expiração |
| 13 | URLs assinadas com expiração | Implementado | `S3_PRESIGN_TTL_SECONDS` (padrão 900s) |
| 14 | Validação de MIME, extensão e tamanho | **Implementado (ETAPA 10)** | MIME + extensão coerentes + limite de tamanho (`occurrences.service.ts`) |
| 15 | Proteção de webhooks / assinatura | N/A (não implementado) | Sem endpoint de webhook; WhatsApp desativado. Exigir assinatura HMAC quando implementado |
| 16 | Gestão segura de secrets | Implementado | Secrets em variáveis de ambiente; **sem** segredos em código. `JWT_SECRET` com força mínima validada (ETAPA 10) |
| 17 | Logs sem credenciais/dados sensíveis | Implementado | Sem log de corpo/headers; `AuditService` sanitiza metadados sensíveis |
| 18 | Política de retenção e descarte | Pendente de definição | A definir com a área de negócio/compliance |
| 19 | Backups e restauração testada | Pendente (infra) | Runbook documentado; execução depende do provedor gerenciado |
| 20 | Princípio do menor privilégio | Implementado | Papéis por projeto; contas ADMINISTRADOR restritas; serviços com escopos mínimos |

---

## 3. Endurecimentos aplicados (ETAPA 10)

### 3.1 Headers de segurança (helmet)

`apps/api/src/common/security/security.middleware.ts` aplica, no bootstrap:

- `helmet()` — CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Cross-Origin-*` e remoção do header `X-Powered-By`.
- CSP **relaxado somente** na rota de documentação (`/api/docs`, Swagger UI usa inline), mantendo o **CSP estrito** nas rotas de API.
- CORS com whitelist explícita (substitui a configuração inline anterior).

O endurecimento foi extraído para `applySecurity(app)` (testável) e permanece aplicado apenas no `main.ts` — os testes E2E não sofrem alteração de comportamento.

### 3.2 Força mínima do `JWT_SECRET`

`apps/api/src/common/config/env.ts` (`validateEnv`) passa a exigir:

- `JWT_SECRET` presente e com **≥ 32 caracteres**;
- em `NODE_ENV=production`, rejeita o valor de exemplo público do `.env.example` (`dev-only-insecure-secret…`).

A aplicação **não inicia** com segredo fraco ou de exemplo em produção.

### 3.3 Validação de anexos (MIME + extensão)

`assertValidAttachment` valida que a **extensão** do arquivo é coerente com o **MIME type** declarado (mapa `MIME → extensões`), além do limite de tamanho. Isso impede que um tipo permitido seja usado para trafegar outro formato (ex.: `.exe` rotulado como `image/png`).

---

## 4. LGPD

| Diretriz | Aplicação |
|---|---|
| Minimização de dados | Coleta limitada ao necessário ao registro de ocorrências e autoria |
| Finalidade e transparência | Dados usados apenas para gestão de testes/homologação |
| Controle de acesso | Isolamento por projeto + RBAC; anexos protegidos |
| Retenção definida | **PENDENTE DE DEFINIÇÃO** (política formal) |
| Atendimento a solicitações | **PENDENTE DE DEFINIÇÃO** (processo/procedimento) |
| Screenshots | Podem conter dados pessoais; acesso restrito e por URL assinada. **Não** enviar a IA/terceiros sem avaliação e configuração |
| IA | Provedor local determinístico, sem rede e sem segredos; insumo restrito a campos não sensíveis ([ia-opcional.md](ia-opcional.md)) |

---

## 5. Vulnerabilidades conhecidas em dependências

Levantamento com `npm audit` (21/11/2026). **Nenhum upgrade com breaking change foi aplicado nesta etapa** — permanecem como pendências para uma tarefa dedicada de atualização de dependências.

| Pacote | Severidade | Origem | Correção |
|---|---|---|---|
| `zod` (< 4.6.6) | Alta | Consumo de memória em coleções grandes | Requer `zod@4` (breaking) |
| `postcss` (via `next`) | Alta | XSS/leitura de arquivos em CSS | Requer `next@16` (breaking) |
| `deepmerge-ts` (< 8.0.0) | Alta | Exaustão de pilha | Ferramental Prisma (dev) |
| `effect` (≤ 3.22.0) | Alta | ReDoS | Ferramental Prisma (dev) |

> Recomendação: planejar a atualização de `zod` e `next` como tarefa própria, com validação completa (typecheck, testes, build) antes de aplicar.

---

## 6. Testes de segurança

- **Isolamento e autorização**: `test/project-isolation.e2e-spec.ts` e cenários de 401/403/404 em cada suíte E2E.
- **Headers/CORS** (ETAPA 10): `src/common/security/security.middleware.spec.ts`.
- **Configuração de secrets** (ETAPA 10): `src/common/config/env.spec.ts`.
- **Upload** (ETAPA 10): caso de extensão incompatível com MIME em `test/occurrence-attachments.e2e-spec.ts`.

---

## 7. Backups e recuperação

Procedimento operacional documentado em [deploy-infraestrutura.md](deploy-infraestrutura.md), seção 8.1. A **execução** do teste de restauração depende do provedor de PostgreSQL gerenciado ainda **PENDENTE DE DEFINIÇÃO**.

---

## 8. Pendências de definição

- Política formal de retenção e descarte — **PENDENTE DE DEFINIÇÃO**.
- Processo de atendimento a solicitações de titulares (LGPD) — **PENDENTE DE DEFINIÇÃO**.
- Atualização de dependências com breaking change (`zod`, `next`) — **PENDENTE**.
- Proteção de imutabilidade da auditoria em nível de banco (trigger/RLS) — **PENDENTE** (hoje garantida na aplicação: sem endpoints de edição/remoção).
- Provedor de observabilidade/logs — **PENDENTE DE DEFINIÇÃO**.

---

## 9. Referências

- Especificação mestra, seções 10, 13 e 14.
- [permissoes-e-isolamento.md](permissoes-e-isolamento.md)
- [contratos-api.md](contratos-api.md)
- [ia-opcional.md](ia-opcional.md)
- [deploy-infraestrutura.md](deploy-infraestrutura.md)
- [plano-incremental.md](plano-incremental.md)
