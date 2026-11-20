/**
 * Regras de transição/permissão de ocorrência replicadas no frontend para
 * orientar a interface (a autorização efetiva é sempre do backend).
 *
 * Espelha `apps/api/src/occurrences/occurrence-status.transitions.ts` e
 * `occurrence-permissions.ts`.
 */
import { OccurrenceStatus, ProjectRole } from '@qualitytest/shared';

export interface TransitionRule {
  to: OccurrenceStatus;
  requiresJustification: boolean;
  allowedRoles: readonly ProjectRole[];
}

/** Papéis que conduzem o trabalho técnico da ocorrência. */
const WORK_ROLES: readonly ProjectRole[] = [ProjectRole.GESTOR, ProjectRole.DESENVOLVEDOR];
/** Papéis que podem cancelar a ocorrência. */
const CANCEL_ROLES: readonly ProjectRole[] = [ProjectRole.GESTOR];

export const OCCURRENCE_STATUS_TRANSITIONS: Readonly<
  Record<OccurrenceStatus, readonly TransitionRule[]>
> = {
  [OccurrenceStatus.ABERTO]: [
    { to: OccurrenceStatus.EM_ANALISE, requiresJustification: false, allowedRoles: WORK_ROLES },
    { to: OccurrenceStatus.CANCELADO, requiresJustification: true, allowedRoles: CANCEL_ROLES },
  ],
  [OccurrenceStatus.EM_ANALISE]: [
    {
      to: OccurrenceStatus.EM_DESENVOLVIMENTO,
      requiresJustification: false,
      allowedRoles: WORK_ROLES,
    },
    { to: OccurrenceStatus.CANCELADO, requiresJustification: true, allowedRoles: CANCEL_ROLES },
  ],
  [OccurrenceStatus.EM_DESENVOLVIMENTO]: [
    {
      to: OccurrenceStatus.AGUARDANDO_HOMOLOGACAO,
      requiresJustification: false,
      allowedRoles: WORK_ROLES,
    },
    { to: OccurrenceStatus.CANCELADO, requiresJustification: true, allowedRoles: CANCEL_ROLES },
  ],
  [OccurrenceStatus.AGUARDANDO_HOMOLOGACAO]: [
    { to: OccurrenceStatus.CONCLUIDO, requiresJustification: false, allowedRoles: WORK_ROLES },
    {
      to: OccurrenceStatus.REPROVADO_HOMOLOGACAO,
      requiresJustification: true,
      allowedRoles: WORK_ROLES,
    },
  ],
  [OccurrenceStatus.REPROVADO_HOMOLOGACAO]: [
    {
      to: OccurrenceStatus.EM_DESENVOLVIMENTO,
      requiresJustification: false,
      allowedRoles: WORK_ROLES,
    },
  ],
  [OccurrenceStatus.CONCLUIDO]: [],
  [OccurrenceStatus.CANCELADO]: [],
};

/** Transições permitidas para o papel informado (`null` = ADMINISTRADOR global). */
export function allowedTransitions(
  from: OccurrenceStatus,
  actorRole: ProjectRole | null,
): TransitionRule[] {
  return OCCURRENCE_STATUS_TRANSITIONS[from].filter(
    (rule) => actorRole === null || rule.allowedRoles.includes(actorRole),
  );
}

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
  actorRole: ProjectRole | null,
  allowedRoles: readonly ProjectRole[],
): boolean {
  return actorRole === null || allowedRoles.includes(actorRole);
}
