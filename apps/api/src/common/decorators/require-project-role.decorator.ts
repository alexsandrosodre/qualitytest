import { SetMetadata } from '@nestjs/common';
import type { ProjectRole } from '@prisma/client';

export const PROJECT_ROLES_KEY = 'projectRoles';

/**
 * Exige um ou mais papéis no projeto-alvo. Avaliado pela `ProjectAccessGuard`
 * após validar o vínculo ativo do usuário (`ProjectMember`). Administradores
 * globais são dispensados da verificação de papel no projeto.
 */
export const RequireProjectRole = (
  ...roles: ProjectRole[]
): MethodDecorator & ClassDecorator => SetMetadata(PROJECT_ROLES_KEY, roles);
