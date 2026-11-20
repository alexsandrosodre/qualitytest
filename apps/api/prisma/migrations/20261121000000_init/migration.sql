-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('GESTOR', 'TESTADOR', 'DESENVOLVEDOR');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "OccurrencePriority" AS ENUM ('CRITICA', 'ALTA', 'MEDIA', 'BAIXA');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('ABERTO', 'EM_ANALISE', 'EM_DESENVOLVIMENTO', 'AGUARDANDO_HOMOLOGACAO', 'REPROVADO_HOMOLOGACAO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OccurrenceCategory" AS ENUM ('ERRO_FUNCIONAL', 'ERRO_VISUAL', 'ERRO_INTEGRACAO', 'ERRO_VALIDACAO', 'DESEMPENHO', 'SEGURANCA', 'ACESSIBILIDADE', 'COMPATIBILIDADE', 'OUTROS');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('DEVELOPMENT', 'TESTING', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'TEAMS');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('OCCURRENCE_CREATED', 'OCCURRENCE_UPDATED', 'OCCURRENCE_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDENTE', 'ENVIADO', 'FALHA', 'DESCARTADO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "globalRole" "GlobalRole",
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ATIVO',
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_environments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "type" "EnvironmentType" NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ATIVO',

    CONSTRAINT "project_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_domain_mappings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domainPattern" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "project_domain_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrences" (
    "id" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" "OccurrenceCategory" NOT NULL,
    "priority" "OccurrencePriority" NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'ABERTO',
    "reporterUserId" TEXT NOT NULL,
    "assigneeUserId" TEXT,
    "pageUrl" TEXT,
    "pageTitle" TEXT,
    "browserInfo" TEXT,
    "operatingSystemInfo" TEXT,
    "viewportInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_attachments" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occurrence_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_comments" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occurrence_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_history" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occurrence_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_destinations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "destinationConfig" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "filters" JSONB,
    "destinationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDENTE',
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "projectId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateIndex
CREATE INDEX "project_members_projectId_status_idx" ON "project_members"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE INDEX "project_environments_projectId_idx" ON "project_environments"("projectId");

-- CreateIndex
CREATE INDEX "project_domain_mappings_projectId_idx" ON "project_domain_mappings"("projectId");

-- CreateIndex
CREATE INDEX "project_domain_mappings_environmentId_idx" ON "project_domain_mappings"("environmentId");

-- CreateIndex
CREATE INDEX "project_domain_mappings_domainPattern_idx" ON "project_domain_mappings"("domainPattern");

-- CreateIndex
CREATE UNIQUE INDEX "occurrences_publicCode_key" ON "occurrences"("publicCode");

-- CreateIndex
CREATE INDEX "occurrences_projectId_status_idx" ON "occurrences"("projectId", "status");

-- CreateIndex
CREATE INDEX "occurrences_projectId_priority_idx" ON "occurrences"("projectId", "priority");

-- CreateIndex
CREATE INDEX "occurrences_projectId_categoryId_idx" ON "occurrences"("projectId", "categoryId");

-- CreateIndex
CREATE INDEX "occurrences_projectId_reporterUserId_idx" ON "occurrences"("projectId", "reporterUserId");

-- CreateIndex
CREATE INDEX "occurrences_projectId_assigneeUserId_idx" ON "occurrences"("projectId", "assigneeUserId");

-- CreateIndex
CREATE INDEX "occurrences_projectId_createdAt_idx" ON "occurrences"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "occurrence_attachments_occurrenceId_idx" ON "occurrence_attachments"("occurrenceId");

-- CreateIndex
CREATE INDEX "occurrence_comments_occurrenceId_createdAt_idx" ON "occurrence_comments"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "occurrence_history_occurrenceId_createdAt_idx" ON "occurrence_history"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_destinations_projectId_idx" ON "notification_destinations"("projectId");

-- CreateIndex
CREATE INDEX "notification_rules_projectId_eventType_idx" ON "notification_rules"("projectId", "eventType");

-- CreateIndex
CREATE INDEX "notification_deliveries_occurrenceId_destinationId_idempote_idx" ON "notification_deliveries"("occurrenceId", "destinationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_projectId_createdAt_idx" ON "audit_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "refresh_sessions_userId_idx" ON "refresh_sessions"("userId");

-- CreateIndex
CREATE INDEX "refresh_sessions_tokenHash_idx" ON "refresh_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "ai_analyses_occurrenceId_idx" ON "ai_analyses"("occurrenceId");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_environments" ADD CONSTRAINT "project_environments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_domain_mappings" ADD CONSTRAINT "project_domain_mappings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_domain_mappings" ADD CONSTRAINT "project_domain_mappings_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "project_environments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "project_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_attachments" ADD CONSTRAINT "occurrence_attachments_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_attachments" ADD CONSTRAINT "occurrence_attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_comments" ADD CONSTRAINT "occurrence_comments_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_comments" ADD CONSTRAINT "occurrence_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_history" ADD CONSTRAINT "occurrence_history_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_history" ADD CONSTRAINT "occurrence_history_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_destinations" ADD CONSTRAINT "notification_destinations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "notification_destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "notification_destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

