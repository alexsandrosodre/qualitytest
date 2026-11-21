import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, type Occurrence } from '@prisma/client';
import type { AiAnalysesResult } from '@qualitytest/shared';

import { ProjectAccessService } from '../common/access/project-access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  AI_PROVIDER,
  type AiCandidateOccurrence,
  type AiOccurrenceInput,
  type AiProvider,
} from './ai-provider';
import { toAiAnalysisView, type AiAnalysisView } from './ai-analysis.mapper';

/** Máximo de ocorrências candidatas carregadas para detectar duplicidade. */
const MAX_CANDIDATES = 50;

/**
 * Serviço do módulo OPCIONAL de IA (seção 8).
 *
 * - Lista as análises registradas de uma ocorrência (qualquer membro ativo).
 * - Gera novas sugestões (assistivas) e as registra em `AIAnalysis`.
 *
 * O isolamento por projeto é delegado à `ProjectAccessService` (fonte única),
 * resolvendo o projeto a partir da própria ocorrência. Nenhuma sugestão altera
 * a ocorrência: a aplicação é sempre uma ação humana separada.
 */
@Injectable()
export class AiAnalysesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: ProjectAccessService,
    private readonly auditService: AuditService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

  /** Lista as análises da ocorrência (mais recentes primeiro) e o estado do módulo. */
  async listAnalyses(actor: AuthenticatedUser, occurrenceId: string): Promise<AiAnalysesResult> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    await this.accessService.resolveMembership(actor, occurrence.projectId);

    const analyses = await this.prisma.aIAnalysis.findMany({
      where: { occurrenceId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      enabled: this.provider.enabled,
      provider: this.provider.name,
      model: this.provider.model,
      items: analyses.map(toAiAnalysisView),
    };
  }

  /**
   * Gera e registra sugestões de IA para a ocorrência.
   *
   * Quando o módulo está desativado, responde 503 — a interface deve ocultar a
   * ação. As sugestões são apenas registradas; aplicá-las exige confirmação
   * humana explícita no endpoint de atualização da ocorrência.
   */
  async generateSuggestions(
    actor: AuthenticatedUser,
    occurrenceId: string,
  ): Promise<AiAnalysisView> {
    const occurrence = await this.resolveOccurrenceOrFail(occurrenceId);
    await this.accessService.resolveMembership(actor, occurrence.projectId);

    if (!this.provider.enabled) {
      throw new ServiceUnavailableException(
        'O módulo de IA está desativado. Habilite-o com AI_ENABLED=true para gerar sugestões.',
      );
    }

    const candidates = await this.prisma.occurrence.findMany({
      where: { projectId: occurrence.projectId },
      orderBy: { createdAt: 'desc' },
      take: MAX_CANDIDATES + 1,
    });

    const result = await this.provider.suggest({
      occurrence: toOccurrenceInput(occurrence),
      candidates: candidates
        .filter((candidate) => candidate.id !== occurrence.id)
        .slice(0, MAX_CANDIDATES)
        .map(toCandidateOccurrence),
    });

    const saved = await this.prisma.aIAnalysis.create({
      data: {
        occurrenceId,
        provider: result.provider,
        model: result.model,
        suggestions: result.suggestions as unknown as Prisma.InputJsonValue,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'AI_ANALYSIS_GENERATED',
      entityType: 'AIAnalysis',
      entityId: saved.id,
      projectId: occurrence.projectId,
      metadata: {
        provider: result.provider,
        model: result.model,
        suggestionsCount: result.suggestions.length,
      },
    });

    return toAiAnalysisView(saved);
  }

  private async resolveOccurrenceOrFail(occurrenceId: string): Promise<Occurrence> {
    const occurrence = await this.prisma.occurrence.findUnique({ where: { id: occurrenceId } });

    if (occurrence === null) {
      throw new NotFoundException('Ocorrência não encontrada.');
    }

    return occurrence;
  }
}

/** Converte a ocorrência persistida no insumo do provedor (sem dados sensíveis). */
function toOccurrenceInput(occurrence: Occurrence): AiOccurrenceInput {
  return {
    id: occurrence.id,
    publicCode: occurrence.publicCode,
    title: occurrence.title,
    description: occurrence.description,
    categoryId: occurrence.categoryId,
    priority: occurrence.priority,
  };
}

function toCandidateOccurrence(occurrence: Occurrence): AiCandidateOccurrence {
  return {
    id: occurrence.id,
    publicCode: occurrence.publicCode,
    title: occurrence.title,
    description: occurrence.description,
  };
}
