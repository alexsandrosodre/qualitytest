# syntax=docker/dockerfile:1
# =============================================================================
# QUALITY TEST - Imagem da API (NestJS)
# =============================================================================
# O contexto de build é a RAIZ do monorepo (npm workspaces):
#
#   docker build -f docker/api.Dockerfile -t qualitytest-api .
#
# Execução (as variáveis vêm do ambiente/cofre — ver
# docs/architecture/deploy-infraestrutura.md; nunca embutir segredos na imagem):
#
#   docker run --rm -p 3333:3333 --env-file .env.production qualitytest-api
#
# Migrações são aplicadas separadamente (`prisma migrate deploy`), não no boot.
# =============================================================================

# --- Estágio de build --------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=development

# Ferramentas de compilação: usadas pelo node-gyp quando o binário pré-compilado
# de dependências nativas (ex.: argon2) não está disponível para a plataforma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copia o monorepo (respeitando o .dockerignore) e instala as dependências.
# O `postinstall` da raiz compila @qualitytest/shared.
COPY . .
RUN npm ci

# Gera o Prisma Client (necessário para compilar a API).
RUN npm run db:generate

# Compila a API (saída em apps/api/dist).
RUN npm run build --workspace @qualitytest/api

# --- Estágio de execução -----------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copia apenas o necessário para executar: dependências resolvidas (inclui o
# Prisma Client gerado), o pacote compartilhado e a API compilada.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api

EXPOSE 3333
USER node

# Healthcheck baseado na rota pública /api/health (a mesma usada pelo smoke test).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const p=process.env.API_PORT||process.env.PORT||'3333';fetch('http://127.0.0.1:'+p+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
