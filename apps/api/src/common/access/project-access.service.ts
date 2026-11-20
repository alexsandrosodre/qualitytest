import { ForbiddenException, Injectable } from '@nestjs/common';
import { GlobalRole, RegistrationStatus, type ProjectRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser, ResolvedMembership } from '../types/authenticated-user';

/**
 * Fonte única da lógica de autorização por projeto (seção 2.2 / 5.1).
 *
 * Reutilizado tanto pela `ProjectAccessGuard` (rotas com `:projectId`) quanto
 * pelos serviços que resolvem o projeto a partir do recurso (ex.: ocorrências).
 * Centralizar aqui evita duplicar o mecanismo de isolamento.
 *
 * Regras:
 * - ADMINISTRADOR global tem acesso a qualquer projeto (retorna `null`).
 * - Demais usuários exigem `ProjectMember` com `status = ATIVO`.
 * - Quando `requiredRoles` é informado, o papel no projeto precisa constar na
 *   lista (administradores globais são dispensados).
 * - O `projectId` recebido é tratado como intenção e SEMPRE validado contra o
 *   vínculo persistido — nunca é fonte de autorização.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveMembership(
    actor: AuthenticatedUser,
    projectId: string,
    requiredRoles?: ProjectRole[],
  ): Promise<ResolvedMembership | null> {
    if (actor.globalRole === GlobalRole.ADMINISTRADOR) {
      return null;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: actor.id } },
    });

    if (membership === null || membership.status !== RegistrationStatus.ATIVO) {
      throw new ForbiddenException('Usuário não possui acesso ao projeto informado.');
    }

    if (
      requiredRoles !== undefined &&
      requiredRoles.length > 0 &&
      !requiredRoles.includes(membership.role)
    ) {
      throw new ForbiddenException('Permissão insuficiente neste projeto.');
    }

    return {
      id: membership.id,
      projectId: membership.projectId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
    };
  }
}
