import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  /** Autor da ação (`User.id`). */
  actorUserId: string;
  /** Tipo de ação (ex.: `AUTH_LOGIN`, `USER_CREATED`). */
  action: string;
  /** Entidade afetada (ex.: `User`, `ProjectMember`). */
  entityType: string;
  /** Identificador da entidade afetada. */
  entityId: string;
  /** Projeto relacionado (nullable para eventos globais). */
  projectId?: string | null;
  /** Metadados adicionais. NUNCA inclua senhas ou tokens. */
  metadata?: Record<string, unknown> | null;
}

/**
 * Chaves sensíveis removidas de `metadata` como salvaguarda adicional
 * (a responsabilidade primária é do chamador).
 */
const SENSITIVE_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'token',
  'tokenhash',
  'refreshtoken',
  'accesstoken',
  'secret',
]);

function sanitizeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (metadata === null || metadata === undefined) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) {
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}

/** Grava eventos na trilha de auditoria (`AuditLog`). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    const metadata = sanitizeMetadata(entry.metadata);

    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        projectId: entry.projectId ?? null,
        ...(metadata === undefined ? {} : { metadata: metadata as Prisma.InputJsonValue }),
      },
    });
  }
}
