import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, RegistrationStatus, type ProjectRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { PROJECT_ROLES_KEY } from '../decorators/require-project-role.decorator';
import type { AuthenticatedUser, ResolvedMembership } from '../types/authenticated-user';

interface ProjectScopedRequest {
  user?: AuthenticatedUser;
  params?: Record<string, string>;
  projectMembership?: ResolvedMembership | null;
}

/**
 * Guard de isolamento por projeto para rotas com `:projectId`.
 *
 * - Administrador global: passa (sem vínculo).
 * - Demais usuários: exige `ProjectMember` ATIVO no projeto; caso contrário 403.
 * - Quando a rota possui `@RequireProjectRole(...)`, valida também o papel no projeto.
 *
 * Nunca confia no `projectId` do cliente como fonte de autorização: o valor
 * recebido é tratado como intenção e validado contra o vínculo persistido.
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ProjectScopedRequest>();
    const user = request.user;

    if (user === undefined) {
      throw new UnauthorizedException('Sessão inválida ou ausente.');
    }

    const projectId = request.params?.['projectId'];

    if (projectId === undefined || projectId.length === 0) {
      throw new BadRequestException('Parâmetro projectId obrigatório.');
    }

    if (user.globalRole === GlobalRole.ADMINISTRADOR) {
      request.projectMembership = null;
      return true;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });

    if (membership === null || membership.status !== RegistrationStatus.ATIVO) {
      throw new ForbiddenException('Usuário não possui acesso ao projeto informado.');
    }

    request.projectMembership = {
      id: membership.id,
      projectId: membership.projectId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
    };

    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(PROJECT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (
      requiredRoles !== undefined &&
      requiredRoles.length > 0 &&
      !requiredRoles.includes(membership.role)
    ) {
      throw new ForbiddenException('Permissão insuficiente neste projeto.');
    }

    return true;
  }
}
