# QUALITY TEST

Plataforma corporativa para centralizar o registro e o acompanhamento de testes, defeitos,
inconsistências e problemas identificados durante a homologação dos sistemas.

> **Estado atual: Etapas 1 a 10 concluídas; Etapa 11 (DEPLOY) em preparação; Etapa 12 (DOCUMENTAÇÃO E ENTREGA) concluída, exceto o PDF consolidado.**
> A plataforma já inclui API (auth, usuários, projetos, ocorrências, notificações e IA opcional),
> frontend Next.js, worker BullMQ e extensão Chrome. Os artefatos de deploy (Dockerfiles, CI e
> runbooks) estão versionados, mas **nenhum deploy de produção foi executado** — isso depende de
> autorização explícita e da definição de provedores/domínio/credenciais.
> A especificação mestra está em `Quality_Test_Especificacao_Mestre_GitHub_Vercel_v4.txt` e a
> documentação em `docs/` (índice em `docs/README.md`).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js (App Router) + React 19 + TypeScript strict + Tailwind CSS 4 |
| Backend | NestJS 11 + Prisma ORM + Swagger |
| Banco | PostgreSQL 16 |
| Filas | Redis 7 + BullMQ |
| Storage (dev) | MinIO (S3 compatível) |
| Compartilhado | pacote `@qualitytest/shared` (enums, DTOs e schemas Zod) |

---

## Estrutura do repositório

```text
qualitytest/
├── apps/
│   ├── api/        # Backend NestJS + Prisma + Swagger
│   ├── web/        # Frontend Next.js (App Router)
│   ├── worker/     # Worker BullMQ
│   └── extension/  # Extensão Chrome (Manifest V3)
├── packages/
│   └── shared/     # Tipos, enums e schemas Zod compartilhados
├── docker/         # docker-compose de dev e Dockerfiles de build
├── scripts/        # Helpers de desenvolvimento
├── docs/           # Documentação (índice em docs/README.md; manuais em docs/manuais/)
└── .github/workflows/ci.yml
```

---

## Pré-requisitos

- Node.js **>= 20** (recomendado 24 — ver `.nvmrc`)
- npm 10+
- Docker + Docker Compose (para os serviços locais)

---

## Como rodar localmente (passo a passo)

### 1. Instalar dependências

Na raiz do repositório:

```powershell
npm install
```

O `postinstall` compila `@qualitytest/shared` e gera o Prisma Client automaticamente.

### 2. Configurar variáveis de ambiente

```powershell
Copy-Item .env.example .env
```

O arquivo `.env` é ignorado pelo Git. Os valores padrão do `.env.example` são apenas de
desenvolvimento e casam com o `docker/docker-compose.yml`.

### 3. Subir os serviços de desenvolvimento

```powershell
npm run docker:up
```

Sobe `postgres` (5432) e `redis` (6379).

O storage S3 de desenvolvimento é **opcional** e escolhido por profile. As duas opções
expõem o mesmo endpoint (`http://localhost:9000`), então o `.env` não muda:

```powershell
# Opção A - MinIO (requer baixar a imagem minio/minio)
npm run docker:up:minio

# Opção B - S3 mock (moto), para ambientes onde minio/minio está bloqueado
npm run docker:up:s3mock
```

O bucket usado pelo `.env` (`S3_BUCKET=qualitytest-dev`) precisa existir uma única vez.
Crie-o depois de subir o storage (exemplo com o mock em execução):

```powershell
Invoke-RestMethod -Method Put -Uri "http://localhost:9000/qualitytest-dev" -Body ""
```

Para aguardar os serviços ficarem prontos:

```powershell
npm run docker:wait
```

Para derrubar (inclui o storage, se ativo):

```powershell
npm run docker:down
```

### 4. Aplicar migrações e seed (somente desenvolvimento)

```powershell
npm run db:migrate
$env:SEED_ADMIN_PASSWORD = "Teste@12345"
npm run db:seed
```

> `SEED_ADMIN_PASSWORD` é obrigatória. Se estiver ausente, o seed falha com mensagem clara.
> Nenhuma senha real é versionada no repositório.

### 5. Rodar as aplicações

Em terminais separados:

```powershell
npm run dev:api      # API em http://localhost:3333/api  (Swagger em /api/docs)
npm run dev:web      # Frontend em http://localhost:3000
npm run dev:worker   # Worker BullMQ (fila "notifications")
```

Verificação rápida da API:

```powershell
Invoke-RestMethod http://localhost:3333/api/health
```

---

## Autenticação e autorização

A autenticação é **própria** (não gerenciada). O transporte é via cabeçalho
`Authorization: Bearer <accessToken>` — **sem cookies**.

- **Access token:** JWT de vida curta (`JWT_ACCESS_TTL`, padrão `15m`) assinado com `JWT_SECRET`.
  Payload mínimo: `sub` (id do usuário) + perfil global (`globalRole`). Permissões de projeto são
  resolvidas por requisição a partir de `ProjectMember`.
- **Refresh token:** string opaca (`JWT_REFRESH_TTL`, padrão `7d`), persistida **apenas como hash
  SHA-256** em `RefreshSession`. Há **rotação** a cada refresh e **revogação** no logout.
- **Senhas:** hash com **argon2id**. Nunca são armazenadas em texto puro nem retornadas nas respostas.
- **Redefinição de senha:** o token de uso único é persistido (como hash) reutilizando
  `RefreshSession`. Nesta etapa **não há provedor de e-mail**: o evento é apenas auditado.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Autentica e emite access + refresh token |
| POST | `/api/auth/refresh` | Rotaciona o refresh token |
| POST | `/api/auth/logout` | Revoga o refresh token informado |
| GET | `/api/auth/me` | Usuário autenticado e seus vínculos ativos |
| POST | `/api/auth/forgot-password` | Solicita redefinição (resposta sempre genérica) |
| POST | `/api/auth/reset-password` | Redefine a senha via token de uso único |
| POST | `/api/auth/change-password` | Altera a senha do usuário autenticado |
| POST/GET | `/api/users` | Gestão de usuários (somente `ADMINISTRADOR`) |
| GET/PATCH | `/api/users/:id` | O próprio perfil (ou `ADMINISTRADOR`) |
| PATCH | `/api/users/:id/status` | Ativa/desativa usuário (somente `ADMINISTRADOR`) |
| POST/GET | `/api/projects` | Cria (só `ADMINISTRADOR`) / lista projetos (escopo por vínculo) |
| GET/PATCH | `/api/projects/:projectId` | Detalhe / edição do projeto (membro ativo, edição `ADMINISTRADOR` ou `GESTOR`) |
| PATCH | `/api/projects/:projectId/status` | Ativa/desativa projeto (só `ADMINISTRADOR`) |
| POST/GET | `/api/projects/:projectId/environments` | Ambientes do projeto (criação `ADMINISTRADOR`/`GESTOR`) |
| GET/PATCH/DELETE | `/api/projects/:projectId/environments/:environmentId` | Detalhe / edição / desativação lógica do ambiente |
| POST/GET | `/api/projects/:projectId/domains` | Mapeamentos de domínio (criação `ADMINISTRADOR`/`GESTOR`) |
| PATCH/DELETE | `/api/projects/:projectId/domains/:mappingId` | Edição / remoção do mapeamento de domínio |
| POST/GET | `/api/projects/:projectId/members` | Vínculos do projeto (membro ativo ou `ADMINISTRADOR`) |
| PATCH/DELETE | `/api/projects/:projectId/members/:userId` | Altera papel / desativa vínculo (`ADMINISTRADOR` ou `GESTOR`) |
| POST/GET | `/api/occurrences` | Cria (exige header `Idempotency-Key`) / lista ocorrências do projeto autorizado |
| GET/PATCH | `/api/occurrences/:occurrenceId` | Detalhe / edição de campos permitidos da ocorrência |
| PATCH | `/api/occurrences/:occurrenceId/assignee` | Atribui/reatribui o responsável (`GESTOR`/`ADMINISTRADOR`) |
| PATCH | `/api/occurrences/:occurrenceId/status` | Altera o status respeitando as transições permitidas |
| GET | `/api/occurrences/:occurrenceId/history` | Histórico cronológico de alterações |
| POST/GET | `/api/occurrences/:occurrenceId/comments` | Adiciona / lista comentários |
| PATCH/DELETE | `/api/occurrences/:occurrenceId/comments/:commentId` | Edita / remove comentário (autor, `GESTOR` ou `ADMINISTRADOR`) |
| POST/GET | `/api/occurrences/:occurrenceId/attachments` | Solicita upload (URL assinada) / lista anexos |
| GET | `/api/occurrences/:occurrenceId/attachments/:attachmentId/url` | Gera URL assinada de download |
| DELETE | `/api/occurrences/:occurrenceId/attachments/:attachmentId` | Remove anexo (autor, `GESTOR` ou `ADMINISTRADOR`) |

### Controle de acesso (RBAC + isolamento por projeto)

- **Perfil global** (`GlobalRole`): `ADMINISTRADOR` acessa qualquer projeto; os demais perfis
  dependem de vínculo.
- **Vínculo por projeto** (`ProjectMember.role`): `GESTOR`, `TESTADOR` ou `DESENVOLVEDOR`.
- O `projectId` enviado pelo cliente é tratado como **intenção** e sempre validado contra um
  `ProjectMember` **ATIVO** — nunca é fonte de autorização.
- Rate limiting global (`THROTTLE_TTL`/`THROTTLE_LIMIT`) com limites mais restritos em
  login/refresh/redefinição de senha.

---

## Scripts da raiz

| Script | Descrição |
|---|---|
| `npm run lint` | ESLint (flat config) em todo o monorepo |
| `npm run lint:fix` | ESLint com correção automática |
| `npm run format` | Prettier (escrita) |
| `npm run format:check` | Prettier (verificação) |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces |
| `npm test` | Testes de todos os workspaces que possuem script `test` |
| `npm run build` | Build de `shared` → `api` → `worker` → `web` |
| `npm run docker:up` / `docker:down` | Serviços de desenvolvimento (`postgres` + `redis`; `down` inclui storage) |
| `npm run docker:up:minio` / `docker:up:s3mock` | Storage S3 de dev via profile (MinIO ou mock) |
| `npm run docker:wait` | Aguarda Postgres/Redis aceitarem conexão |
| `npm run db:migrate` / `db:seed` | Migrações e seed de desenvolvimento |
| `npm run db:migrate:deploy` | Aplica migrações pendentes (ambiente controlado) |
| `npm run docker:build` | Build das imagens Docker da API e do worker |
| `npm run smoke:test` | Smoke test pós-deploy de `/api/health` (`API_BASE_URL`) |
| `npm run docs:openapi` | Regera `docs/api/openapi.json` (OpenAPI estático) |

---

## Variáveis de ambiente

Todas as variáveis estão documentadas em `.env.example`. O modelo de produção (sem valores
reais) está em `.env.production.example`. Destaques:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL usada pelo Prisma |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` / `REDIS_PASSWORD` | Conexão Redis (BullMQ) |
| `API_PORT` | Porta da API (padrão 3333) |
| `CORS_ORIGIN` | Origens permitidas no CORS, separadas por vírgula |
| `JWT_SECRET` | Segredo de assinatura do access token (obrigatório) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Tempos de vida do access/refresh token |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limiting global (janela em segundos / requisições) |
| `NEXT_PUBLIC_API_URL` | URL da API usada pelo frontend |
| `MINIO_*` / `S3_*` | Storage S3 compatível (desenvolvimento) |
| `SEED_ADMIN_PASSWORD` | Senha do administrador criado pelo seed (nunca versionar) |

---

## Integração contínua

`.github/workflows/ci.yml` executa, em push e pull request para `main`:
`npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.
Em seguida, o job `docker-images` valida o build das imagens Docker da API e do worker
(`docker/api.Dockerfile` e `docker/worker.Dockerfile`), sem publicá-las.

`.github/workflows/release.yml` é executado **manualmente** (ou por tag `v*`): publica as
imagens no GHCR (via `GITHUB_TOKEN`) e, opcionalmente, aplica migrações sob o environment
`production` — que deve ter revisores obrigatórios configurados. Nenhum deploy de produção
é executado sem autorização explícita.

Nenhum workflow executa deploy de produção. O `release.yml` usa apenas o `GITHUB_TOKEN`
(automático) e, quando as migrações são solicitadas, o segredo `DATABASE_URL` do environment
`production`.

---

## Documentação e entrega

- Índice geral: `docs/README.md`.
- Manuais de uso por perfil: `docs/manuais/` (administrador, gestor, testador, desenvolvedor e extensão Chrome).
- Runbook de operação: `docs/architecture/runbook-operacao.md`.
- Relatório de testes: `docs/architecture/relatorio-de-testes.md`.
- Checklist de aceite (seção 22): `docs/architecture/checklist-de-aceite.md`.
- Pendências conhecidas: `docs/architecture/pendencias-conhecidas.md`.
- OpenAPI estático: `docs/api/openapi.json` (regerar com `npm run docs:openapi`).

Pendências não bloqueantes incluem o PDF consolidado e o E2E de navegador (ver `docs/architecture/pendencias-conhecidas.md`).
