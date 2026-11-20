# QUALITY TEST

Plataforma corporativa para centralizar o registro e o acompanhamento de testes, defeitos,
inconsistências e problemas identificados durante a homologação dos sistemas.

> **Estado atual: Etapa 2 (FUNDAÇÃO) concluída.**
> Não existem telas de produto, autenticação ou regras de negócio implementadas ainda.
> A especificação mestra está em `Quality_Test_Especificacao_Mestre_GitHub_Vercel_v4.txt` e a
> documentação de arquitetura em `docs/architecture/`.

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
│   └── worker/     # Worker BullMQ (esqueleto)
├── packages/
│   └── shared/     # Tipos, enums e schemas Zod compartilhados
├── docker/         # docker-compose de desenvolvimento
├── scripts/        # Helpers de desenvolvimento
├── docs/           # Documentação de arquitetura (não alterar sem necessidade)
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

Sobe `postgres` (5432), `redis` (6379) e `minio` (9000/9002).
Para aguardar os serviços ficarem prontos:

```powershell
npm run docker:wait
```

Para derrubar:

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
| `npm run docker:up` / `docker:down` | Serviços de desenvolvimento |
| `npm run docker:wait` | Aguarda Postgres/Redis aceitarem conexão |
| `npm run db:migrate` / `db:seed` | Migrações e seed de desenvolvimento |

---

## Variáveis de ambiente

Todas as variáveis estão documentadas em `.env.example`. Destaques:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL usada pelo Prisma |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` / `REDIS_PASSWORD` | Conexão Redis (BullMQ) |
| `API_PORT` | Porta da API (padrão 3333) |
| `CORS_ORIGIN` | Origens permitidas no CORS, separadas por vírgula |
| `NEXT_PUBLIC_API_URL` | URL da API usada pelo frontend |
| `MINIO_*` / `S3_*` | Storage S3 compatível (desenvolvimento) |
| `SEED_ADMIN_PASSWORD` | Senha do administrador criado pelo seed (nunca versionar) |

---

## Integração contínua

`.github/workflows/ci.yml` executa, em push e pull request para `main`:
`npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.

O pipeline não faz deploy e não utiliza secrets.

---

## Fora do escopo desta etapa

Autenticação, autorização (RBAC por projeto), CRUD de projetos e ocorrências, anexos,
comentários, dashboard, extensão do Chrome, notificações WhatsApp e IA são entregues nas etapas
seguintes (ver seção 19 da especificação e `docs/architecture/plano-incremental.md`).
