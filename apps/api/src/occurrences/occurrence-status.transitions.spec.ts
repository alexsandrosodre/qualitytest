import { OccurrenceStatus, ProjectRole } from '@prisma/client';

import {
  evaluateStatusTransition,
  nextStatuses,
  OCCURRENCE_STATUS_TRANSITIONS,
} from './occurrence-status.transitions';

describe('Matriz de transição de status (unitário)', () => {
  const GESTOR = ProjectRole.GESTOR;
  const DESENVOLVEDOR = ProjectRole.DESENVOLVEDOR;
  const TESTADOR = ProjectRole.TESTADOR;

  describe('transições válidas do fluxo feliz', () => {
    it.each([
      [OccurrenceStatus.ABERTO, OccurrenceStatus.EM_ANALISE],
      [OccurrenceStatus.EM_ANALISE, OccurrenceStatus.EM_DESENVOLVIMENTO],
      [OccurrenceStatus.EM_DESENVOLVIMENTO, OccurrenceStatus.AGUARDANDO_HOMOLOGACAO],
      [OccurrenceStatus.AGUARDANDO_HOMOLOGACAO, OccurrenceStatus.CONCLUIDO],
      [OccurrenceStatus.REPROVADO_HOMOLOGACAO, OccurrenceStatus.EM_DESENVOLVIMENTO],
    ])('permite %s -> %s para GESTOR', (from, to) => {
      const decision = evaluateStatusTransition({
        from,
        to,
        actorProjectRole: GESTOR,
        justification: 'qualquer',
      });
      expect(decision.allowed).toBe(true);
      expect(decision.code).toBe('OK');
    });

    it('permite DESENVOLVEDOR conduzir o trabalho técnico', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.EM_ANALISE,
        to: OccurrenceStatus.EM_DESENVOLVIMENTO,
        actorProjectRole: DESENVOLVEDOR,
      });
      expect(decision.allowed).toBe(true);
    });

    it('permite ADMINISTRADOR global (papel null)', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.ABERTO,
        to: OccurrenceStatus.EM_ANALISE,
        actorProjectRole: null,
      });
      expect(decision.allowed).toBe(true);
    });
  });

  describe('transições proibidas pelo fluxo', () => {
    it('rejeita ABERTO -> CONCLUIDO (salto indevido)', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.ABERTO,
        to: OccurrenceStatus.CONCLUIDO,
        actorProjectRole: GESTOR,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('NOT_ALLOWED');
    });

    it('rejeita saída de estado terminal (CONCLUIDO)', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.CONCLUIDO,
        to: OccurrenceStatus.EM_DESENVOLVIMENTO,
        actorProjectRole: GESTOR,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('NOT_ALLOWED');
    });

    it('rejeita saída de estado terminal (CANCELADO)', () => {
      expect(nextStatuses(OccurrenceStatus.CANCELADO)).toEqual([]);
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.CANCELADO,
        to: OccurrenceStatus.ABERTO,
        actorProjectRole: null,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('NOT_ALLOWED');
    });

    it('rejeita transição para o mesmo status', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.ABERTO,
        to: OccurrenceStatus.ABERTO,
        actorProjectRole: GESTOR,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('SAME_STATUS');
    });
  });

  describe('restrições por papel', () => {
    it('TESTADOR não pode alterar status', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.ABERTO,
        to: OccurrenceStatus.EM_ANALISE,
        actorProjectRole: TESTADOR,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('FORBIDDEN');
    });

    it('DESENVOLVEDOR não pode cancelar', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.EM_ANALISE,
        to: OccurrenceStatus.CANCELADO,
        actorProjectRole: DESENVOLVEDOR,
        justification: 'motivo',
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('FORBIDDEN');
    });
  });

  describe('justificativa obrigatória', () => {
    it('exige justificativa para reprovar em homologação', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.AGUARDANDO_HOMOLOGACAO,
        to: OccurrenceStatus.REPROVADO_HOMOLOGACAO,
        actorProjectRole: GESTOR,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('JUSTIFICATION_REQUIRED');
      expect(decision.requiresJustification).toBe(true);
    });

    it('aceita reprovação com justificativa preenchida', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.AGUARDANDO_HOMOLOGACAO,
        to: OccurrenceStatus.REPROVADO_HOMOLOGACAO,
        actorProjectRole: GESTOR,
        justification: 'Falha reaberta pelo cliente.',
      });
      expect(decision.allowed).toBe(true);
    });

    it('exige justificativa para cancelar', () => {
      const decision = evaluateStatusTransition({
        from: OccurrenceStatus.ABERTO,
        to: OccurrenceStatus.CANCELADO,
        actorProjectRole: GESTOR,
        justification: '   ',
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('JUSTIFICATION_REQUIRED');
    });
  });

  it('a matriz não expõe estados de saída em estados terminais', () => {
    expect(OCCURRENCE_STATUS_TRANSITIONS[OccurrenceStatus.CONCLUIDO]).toHaveLength(0);
    expect(OCCURRENCE_STATUS_TRANSITIONS[OccurrenceStatus.CANCELADO]).toHaveLength(0);
  });
});
