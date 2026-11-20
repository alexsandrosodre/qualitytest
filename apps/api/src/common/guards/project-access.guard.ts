import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ProjectRole } from '@prisma/client';

import { ProjectAccessService } from '../access/project-access.service';
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
 * A lógica de autorização é delegada à `ProjectAccessService` (fonte única).
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly accessService: ProjectAccessService,
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

    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(PROJECT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    request.projectMembership = await this.accessService.resolveMembership(
      user,
      projectId,
      requiredRoles,
    );

    return true;
  }
}
