# Runbook de Operação

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado

---

## 1. Objetivo

Reunir, em um único lugar, os procedimentos operacionais do QUALITY TEST: instalação local, operação dos serviços, migrações, backup/restauração e monitoramento/troubleshooting.

> Este runbook descreve o que **está implementado**. Decisões que dependem de infraestrutura externa (provedores gerenciados, domínio, registry, observabilidade) estão marcadas como **PENDENTE DE DEFINIÇÃO** e detalhadas em [deploy-infraestrutura.md](deploy-infraestrutura.md) e [pendencias-conhecidas.md](pendencias-conhecidas.md).

---

## 2. Pré-requisitos

- Node.js **>= 20** (recomendado 24 — ver `.nvmrc`)
- npm 10+
- Docker + Docker Compose (para os serviços locais)
- Windows PowerShell (exemplos deste runbook) ou shell equivalente

---

## 3. Instalação local

### 3.1 Instalar dependências

Na raiz do repositório:

```powershell
npm install
```

O `postinstall` compila `@qualitytest/shared` e gera o Prisma Client automaticamente.

### 3.2 Configurar variáveis de ambiente

```powershell
Copy-Item .env.example .env
```

O `.env` é ignorado pelo Git. Os valores padrão do `.env.example` são de **desenvolvimento** e casam com `docker/docker-compose.yml`. Variáveis de destaque: `DATABASE_URL`, `REDIS_*`, `API_PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `JWT_ACCESS_TTL`/`JWT_REFRESH_TTL`, `THROTTLE_TTL`/`THROTTLE_LIMIT`, `NEXT_PUBLIC_API_URL`, `S3_*` e `SEED_ADMIN_PASSWORD`.

> `JWT_SECRET` é obrigatório e, em produção, exige **≥ 32 caracteres** (a API recusa o valor de exemplo). Ver [seguranca-lgpd.md](seguranca-lgpd.md).

### 3.3 Subir os serviços de desenvolvimento

```powershell
npm run docker:up
```

Sobe `postgres` (5432) e `redis` (6379). O storage S3 de desenvolvimento é **opcional** (profile):

```powershell
npm run docker:up:minio     # MinIO
# ou
npm run docker:up:s3mock    # S3 mock (moto)
```

Crie o bucket uma única vez (exemplo com o mock em execução):

```powershell
Invoke-RestMethod -Method Put -Uri "http://localhost:9000/qualitytest-dev" -Body ""
```

Aguardar os serviços ficarem prontos:

```powershell
npm run docker:wait
```

### 3.4 Aplicar migrações e seed (somente desenvolvimento)

```powershell
npm run db:migrate
$env:SEED_ADMIN_PASSWORD = "Teste@12345"
npm run db:seed
```

> `SEED_ADMIN_PASSWORD` é obrigatória; se ausente, o seed falha com mensagem clara. Nenhuma senha real é versionada.

### 3.5 Rodar as aplicações

Em terminais separados:

```powershell
npm run dev:api      # API em http://localhost:3333/api  (Swagger em /api/docs)
npm run dev:web      # Frontend em http://localhost:3000
npm run dev:worker   # Worker BullMQ (fila "notifications")
```

---

## 4. Operação

### 4.1 Subir / derrubar serviços

| Ação | Comando |
|---|---|
| Subir Postgres + Redis | `npm run docker:up` |
| Subir storage de dev (profile) | `npm run docker:up:minio` ou `npm run docker:up:s3mock` |
| Aguardar prontidão | `npm run docker:wait` |
| Derrubar (inclui storage) | `npm run docker:down` |

### 4.2 Aplicar migrações (ambiente controlado)

Fora do boot da aplicação, a partir da raiz, com `DATABASE_URL` apontando para o banco alvo:

```powershell
npm run db:migrate:deploy
```

- Revisar a migração (`apps/api/prisma/migrations/`) e o plano de rollback antes de aplicar.
- **Nunca** usar `prisma migrate dev` em produção (pode resetar dados).
- Aplicar antes de publicar a nova versão da API que depende do schema.
- Registrar a versão aplicada e o responsável.

> Detalhes de migração e rollback no [deploy-infraestrutura.md](deploy-infraestrutura.md) §8.2 e §8.3.

### 4.3 Backup e restauração

Procedimento completo no [deploy-infraestrutura.md](deploy-infraestrutura.md) §8.1.

**Backup lógico (pg_dump):**

```bash
pg_dump --format=custom --no-owner --file=qualitytest-$(date +%Y%m%d).dump "$DATABASE_URL"
```

**Restauração (em ambiente isolado):**

```bash
createdb qualitytest_restore
pg_restore --clean --no-owner --dbname=qualitytest_restore qualitytest-YYYYMMDD.dump
```

**Verificação pós-restauração:** aplicar migrações pendentes (`npm run db:migrate:deploy`) e conferir integridade das tabelas-chave (`users`, `projects`, `occurrences`, `audit_logs`). Registrar data, responsável e resultado.

> A **execução** do teste de restauração **ESTÁ PENDENTE** — aguarda o provedor de PostgreSQL gerenciado (PENDENTE DE DEFINIÇÃO).

### 4.4 Build das imagens Docker (validação)

```powershell
npm run docker:build:api      # qualitytest-api:latest
npm run docker:build:worker   # qualitytest-worker:latest
```

> As imagens **não** executam migrações no boot. Publicação em registry é **PENDENTE DE DEFINIÇÃO**.

---

## 5. Monitoramento e troubleshooting

### 5.1 Verificações rápidas

| Verificação | Comando / URL | Esperado |
|---|---|---|
| Saúde da API | `GET http://localhost:3333/api/health` (`Invoke-RestMethod http://localhost:3333/api/health`) | Resposta 200 com status saudável |
| Documentação da API | `http://localhost:3333/api/docs` | Swagger UI carregando |
| Frontend | `http://localhost:3000` | Aplicação carregando |
| Postgres | `localhost:5432` | Conexão aceita |
| Redis | `localhost:6379` | Conexão aceita |
| Storage | `http://localhost:9000` | Endpoint respondendo |

### 5.2 Filas e DLQ

- Fila de notificações: **`notifications`** (BullMQ, `attempts: 3`, backoff exponencial).
- Dead-letter queue: **`notifications-dlq`** — mensagens que esgotam as tentativas são encaminhadas para cá.
- Reprocessamento administrativo: `POST /notifications/deliveries/:deliveryId/reprocess` (**ADMINISTRADOR**), com nova chave de idempotência.

> Detalhes em [notificacoes-whatsapp.md](notificacoes-whatsapp.md).

### 5.3 Logs

- API e worker registram em **`stdout`/`stderr`** (sem credenciais ou dados sensíveis desnecessários).
- Solução de observabilidade/logs centralizados: **PENDENTE DE DEFINIÇÃO**.

### 5.4 Erros comuns

| Sintoma | Causa provável | Ação |
|---|---|---|
| API não inicia com erro de `JWT_SECRET` | Segredo ausente/curto ou valor de exemplo em produção | Definir `JWT_SECRET` com **≥ 32 caracteres** ([seguranca-lgpd.md](seguranca-lgpd.md)) |
| Falha ao conectar no banco | `DATABASE_URL` incorreta ou Postgres não subiu | Conferir `.env` e `npm run docker:wait` |
| Worker sem processar notificações | Redis indisponível ou `NOTIFICATIONS_ENABLED=false` | Conferir `REDIS_*` e a variável de habilitação da fila |
| Upload de anexo rejeitado | MIME divergente da extensão ou acima do limite | Validar tipo/extensão/tamanho permitidos |
| `401/403` em endpoints de projeto | Sem vínculo ativo (`ProjectMember`) | Verificar membership do usuário no projeto |
| CORS bloqueando o frontend | Origem fora de `CORS_ORIGIN` | Ajustar a whitelist (CSV), **sem wildcard** |
| Migração pendente em runtime | Schema à frente do banco | Rodar `npm run db:migrate:deploy` |

---

## 6. Referências

- [README.md](../../README.md)
- [deploy-infraestrutura.md](deploy-infraestrutura.md)
- [seguranca-lgpd.md](seguranca-lgpd.md)
- [notificacoes-whatsapp.md](notificacoes-whatsapp.md)
- [pendencias-conhecidas.md](pendencias-conhecidas.md)
