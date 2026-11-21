# syntax=docker/dockerfile:1
# =============================================================================
# QUALITY TEST - Imagem do worker BullMQ (processamento de notificações)
# =============================================================================
# O contexto de build é a RAIZ do monorepo (npm workspaces):
#
#   docker build -f docker/worker.Dockerfile -t qualitytest-worker .
#
# Execução (processo contínuo; as variáveis vêm do ambiente/cofre — ver
# docs/architecture/deploy-infraestrutura.md):
#
#   docker run --rm --env-file .env.production qualitytest-worker
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

# Gera o Prisma Client (necessário para compilar o worker).
RUN npm run db:generate

# Compila o worker (saída em apps/worker/dist).
RUN npm run build --workspace @qualitytest/worker

# --- Estágio de execução -----------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/worker ./apps/worker

USER node
CMD ["node", "apps/worker/dist/index.js"]
