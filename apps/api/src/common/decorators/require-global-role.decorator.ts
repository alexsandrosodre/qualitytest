import { SetMetadata } from '@nestjs/common';
import type { GlobalRole } from '@prisma/client';

export const GLOBAL_ROLES_KEY = 'globalRoles';

/** Exige um ou mais perfis globais. Avaliado pela `GlobalRolesGuard`. */
export const RequireGlobalRole = (
  ...roles: GlobalRole[]
): MethodDecorator & ClassDecorator => SetMetadata(GLOBAL_ROLES_KEY, roles);
