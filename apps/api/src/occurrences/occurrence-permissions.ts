import { ForbiddenException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';

/**
 * Matriz de permissões de ocorrências (docs/architecture/permissoes-e-isolamento.md,
 * seção 4). O papel tratado aqui é o do VÍNCULO no projeto (`ProjectMember.role`).
 *
 * Convenção: `null` representa o ADMINISTRADOR global, que é autorizado em
 * qualquer projeto (dispensado da verificação de papel). As células "C"
 * (condicionais) da matriz foram resolvidas da forma mais restritiva possível,
 * mantendo o menor privilégio:
 * - Registrar/editar/anexar/comentar/comentar: todos os membros ativos.
 * - Alterar prioridade/status: GESTOR e DESENVOLVEDOR (TESTADOR não altera).
 * - Atribuir responsável e cancelar: apenas GESTOR (+ ADMINISTRADOR global).
 */
export const OCCURRENCE_PERMISSIONS = {
  create: [ProjectRole.GESTOR, ProjectRole.TESTADOR, ProjectRole.DESENVOLVEDOR],
  edit: [ProjectRole.GESTOR, ProjectRole.TESTADOR, ProjectRole.DESENVOLVEDOR],
  editPriority: [ProjectRole.GESTOR, ProjectRole.DESENVOLVEDOR],
  assign: [ProjectRole.GESTOR],
  changeStatus: [ProjectRole.GESTOR, ProjectRole.DESENVOLVEDOR],
  cancel: [ProjectRole.GESTOR],
  comment: [ProjectRole.GESTOR, ProjectRole.TESTADOR, ProjectRole.DESENVOLVEDOR],
  attach: [ProjectRole.GESTOR, ProjectRole.TESTADOR, ProjectRole.DESENVOLVEDOR],
} as const satisfies Record<string, readonly ProjectRole[]>;

/** `true` quando o papel (ou administrador global, `null`) é autorizado. */
export function isRoleAllowed(
  actorProjectRole: ProjectRole | null,
  allowedRoles: readonly ProjectRole[],
): boolean {
  return actorProjectRole === null || allowedRoles.includes(actorProjectRole);
}

/** Lança 403 quando o papel não consta na lista de papéis autorizados. */
export function assertRoleAllowed(
  actorProjectRole: ProjectRole | null,
  allowedRoles: readonly ProjectRole[],
  message: string,
): void {
  if (!isRoleAllowed(actorProjectRole, allowedRoles)) {
    throw new ForbiddenException(message);
  }
}
