import type { GlobalRole, ProjectRole, RegistrationStatus } from '@prisma/client';

/**
 * Payload MÍNIMO do access token (JWT). Não inclui permissões de projeto:
 * elas são resolvidas por requisição a partir de `ProjectMember`.
 */
export interface AccessTokenPayload {
  /** Identificador do usuário (`User.id`). */
  sub: string;
  /** Perfil global do usuário (ou `null` se não possuir). */
  globalRole: GlobalRole | null;
}

/** Usuário autenticado anexado ao request (resolvido no `JwtStrategy`). */
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  globalRole: GlobalRole | null;
  status: RegistrationStatus;
}

/** Vínculo ativo resolvido pela `ProjectAccessGuard` para o request atual. */
export interface ResolvedMembership {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  status: RegistrationStatus;
}
