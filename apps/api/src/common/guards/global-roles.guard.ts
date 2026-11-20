import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { GlobalRole } from '@prisma/client';

import { GLOBAL_ROLES_KEY } from '../decorators/require-global-role.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Guard global de perfis. Aplica-se apenas quando a rota possui
 * `@RequireGlobalRole(...)`. Requer que a `JwtAuthGuard` já tenha resolvido o usuário.
 */
@Injectable()
export class GlobalRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<GlobalRole[]>(GLOBAL_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles === undefined || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (
      user === undefined ||
      user.globalRole === null ||
      !requiredRoles.includes(user.globalRole)
    ) {
      throw new ForbiddenException('Perfil global insuficiente para esta operação.');
    }

    return true;
  }
}
