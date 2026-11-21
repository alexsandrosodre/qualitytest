import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditModule } from '../common/audit/audit.module';
import { AiAnalysesController } from './ai-analyses.controller';
import { AiAnalysesService } from './ai-analyses.service';
import {
  AI_PROVIDER,
  DisabledAiProvider,
  LocalDeterministicAiProvider,
  type AiProvider,
} from './ai-provider';

/**
 * Seleciona o provedor de IA em runtime a partir do ambiente.
 *
 * - `AI_ENABLED` (padrão `false`): quando desativado, usa `DisabledAiProvider`
 *   (nenhuma sugestão é gerada e os endpoints de geração respondem 503).
 * - `AI_PROVIDER` (padrão `local`): apenas `local` está implementado. Outros
 *   valores (ex.: `openai`) caem em `DisabledAiProvider` — adaptadores externos
 *   são previstos atrás do contrato `AiProvider`, mas ainda NÃO conectados.
 */
export function createAiProvider(config: ConfigService): AiProvider {
  const logger = new Logger('AiModule');
  const flag = (config.get<string>('AI_ENABLED') ?? 'false').trim().toLowerCase();

  if (!['true', '1', 'on'].includes(flag)) {
    logger.log('Módulo de IA desativado (AI_ENABLED=false): nenhuma sugestão será gerada.');
    return new DisabledAiProvider();
  }

  const kind = (config.get<string>('AI_PROVIDER') ?? 'local').trim().toLowerCase();

  if (kind === 'local') {
    logger.log('Módulo de IA habilitado com o provedor local determinístico.');
    return new LocalDeterministicAiProvider();
  }

  logger.warn(
    `Provedor de IA "${kind}" não está conectado nesta versão. ` +
      'Mantendo o módulo desativado para não depender de credenciais externas.',
  );
  return new DisabledAiProvider();
}

/**
 * Módulo OPCIONAL de IA (ETAPA 9).
 *
 * Totalmente desacoplado e desativável: por padrão não gera nenhuma sugestão.
 * A autorização por projeto é delegada à `ProjectAccessService` (módulo global).
 */
@Module({
  imports: [AuditModule],
  controllers: [AiAnalysesController],
  providers: [
    AiAnalysesService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: createAiProvider,
    },
  ],
})
export class AiModule {}
