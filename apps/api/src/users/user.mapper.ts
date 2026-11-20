import type { GlobalRole, RegistrationStatus, User } from '@prisma/client';

/**
 * Visão pública do usuário. Serialização EXPLÍCITA: nunca expõe `passwordHash`.
 */
export interface UserView {
  id: string;
  name: string;
  email: string;
  globalRole: GlobalRole | null;
  status: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    globalRole: user.globalRole,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt === null ? null : user.lastLoginAt.toISOString(),
  };
}
