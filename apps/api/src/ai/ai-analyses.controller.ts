import { Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AiAnalysesResult } from '@qualitytest/shared';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AiAnalysesService } from './ai-analyses.service';
import type { AiAnalysisView } from './ai-analysis.mapper';

/**
 * Endpoints do módulo OPCIONAL de IA (seção 8).
 *
 * A autorização é feita no serviço (projeto resolvido a partir da ocorrência
 * via `ProjectAccessService`), pois a rota não possui `:projectId`.
 */
@ApiTags('ai')
@ApiBearerAuth()
@Controller('occurrences/:occurrenceId/ai-analyses')
export class AiAnalysesController {
  constructor(private readonly aiAnalysesService: AiAnalysesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as sugestões de IA da ocorrência e o estado do módulo (membro ativo).',
  })
  @ApiOkResponse({ description: 'Análises registradas (mais recentes primeiro).' })
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
  ): Promise<AiAnalysesResult> {
    return this.aiAnalysesService.listAnalyses(actor, occurrenceId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Gera sugestões de IA para a ocorrência (assistivas; aplicar exige confirmação humana).',
  })
  @ApiCreatedResponse({ description: 'Análise gerada e registrada.' })
  @ApiServiceUnavailableResponse({ description: 'Módulo de IA desativado (AI_ENABLED=false).' })
  generate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
  ): Promise<AiAnalysisView> {
    return this.aiAnalysesService.generateSuggestions(actor, occurrenceId);
  }
}
