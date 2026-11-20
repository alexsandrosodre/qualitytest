import { OccurrenceStatus, ProjectRole } from '@prisma/client';

/**
 * Regras de transição de status de ocorrência (seção 5.4 da especificação e
 * `docs/architecture/modelo-de-dados.md`, seção 6).
 *
 * Este módulo é PURO (sem I/O): é consumido tanto pelo serviço quanto por
 * testes unitários da matriz de transição.
 */

/** Código que classifica o resultado da avaliação (mapeado para exceções no serviço). */
export type TransitionCode =
  | 'OK'
  | 'SAME_STATUS'
  | 'NOT_ALLOWED'
  | 'FORBIDDEN'
  | 'JUSTIFICATION_REQUIRED';

export interface TransitionDecision {
  /** `true` somente quando a transição pode ser aplicada. */
  allowed: boolean;
  code: TransitionCode;
  /** Justificativa textual é obrigatória para efetivar a transição. */
  requiresJustification: boolean;
  /** Papéis de projeto autorizados nesta transição. */
  allowedRoles: readonly ProjectRole[];
  /** Motivo legível (usado como mensagem de erro). */
  reason: string;
}

interface TransitionRule {
  to: OccurrenceStatus;
  requiresJustification: boolean;
  allowedRoles: readonly ProjectRole[];
}

/** Papéis que conduzem o trabalho técnico da ocorrência. */
const WORK_ROLES: readonly ProjectRole[] = [ProjectRole.GESTOR, ProjectRole.DESENVOLVEDOR];
/** Papéis que podem encerrar/cancelar a ocorrência. */
const CANCEL_ROLES: readonly ProjectRole[] = [ProjectRole.GESTOR];

/**
 * Matriz de transições permitidas (origem → destinos). Estados terminais
 * (`CONCLUIDO`, `CANCELADO`) não possuem transições de saída.
 *
 * Justificativa obrigatória nas transições que encerram o fluxo sem conclusão
 * (`CANCELADO`) e na reprovação em homologação (`REPROVADO_HOMOLOGACAO`).
 */
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

/** Destinos possíveis a partir de um status (para exibição/validação). */
export function nextStatuses(from: OccurrenceStatus): OccurrenceStatus[] {
  return OCCURRENCE_STATUS_TRANSITIONS[from].map((rule) => rule.to);
}

/**
 * Avalia (sem I/O) se a transição `from → to` é permitida para o ator.
 *
 * @param actorProjectRole papel no projeto; `null` = ADMINISTRADOR global.
 */
export function evaluateStatusTransition(input: {
  from: OccurrenceStatus;
  to: OccurrenceStatus;
  actorProjectRole: ProjectRole | null;
  justification?: string | undefined;
}): TransitionDecision {
  const { from, to, actorProjectRole, justification } = input;

  if (from === to) {
    return {
      allowed: false,
      code: 'SAME_STATUS',
      requiresJustification: false,
      allowedRoles: [],
      reason: 'A ocorrência já está neste status.',
    };
  }

  const rule = OCCURRENCE_STATUS_TRANSITIONS[from].find((candidate) => candidate.to === to);

  if (rule === undefined) {
    return {
      allowed: false,
      code: 'NOT_ALLOWED',
      requiresJustification: false,
      allowedRoles: [],
      reason: `Transição de status de ${from} para ${to} não é permitida pelo fluxo.`,
    };
  }

  if (actorProjectRole !== null && !rule.allowedRoles.includes(actorProjectRole)) {
    return {
      allowed: false,
      code: 'FORBIDDEN',
      requiresJustification: rule.requiresJustification,
      allowedRoles: rule.allowedRoles,
      reason: 'Permissão insuficiente para esta transição de status.',
    };
  }

  if (rule.requiresJustification && (justification ?? '').trim().length === 0) {
    return {
      allowed: false,
      code: 'JUSTIFICATION_REQUIRED',
      requiresJustification: true,
      allowedRoles: rule.allowedRoles,
      reason: 'Justificativa obrigatória para esta transição de status.',
    };
  }

  return {
    allowed: true,
    code: 'OK',
    requiresJustification: rule.requiresJustification,
    allowedRoles: rule.allowedRoles,
    reason: '',
  };
}
