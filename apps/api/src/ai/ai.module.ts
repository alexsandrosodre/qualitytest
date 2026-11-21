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
import { ExternalAiProvider } from './external-ai.provider';

/** Lê o limite de timeout do provedor externo (ms); `undefined` usa o padrão do adaptador. */
function readTimeoutMs(config: ConfigService): number | undefined {
  const parsed = Number.parseInt(config.get<string>('AI_TIMEOUT_MS') ?? '', 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
}

/**
 * Seleciona o provedor de IA em runtime a partir do ambiente.
 *
 * - `AI_ENABLED` (padrão `false`): quando desativado, usa `DisabledAiProvider`
 *   (nenhuma sugestão é gerada e os endpoints de geração respondem 503).
 * - `AI_PROVIDER` (padrão `local`): `local` usa o provedor determinístico sem
 *   rede; `external` usa o adaptador compatível com OpenAI, exigindo
 *   `AI_BASE_URL`, `AI_API_KEY` e `AI_MODEL`. Sem essas credenciais o módulo
 *   permanece desativado (não dependemos de segredos inexistentes).
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

  if (kind === 'external') {
    const baseUrl = (config.get<string>('AI_BASE_URL') ?? '').trim();
    const apiKey = (config.get<string>('AI_API_KEY') ?? '').trim();
    const model = (config.get<string>('AI_MODEL') ?? '').trim();

    if (baseUrl === '' || apiKey === '' || model === '') {
      logger.warn(
        'AI_PROVIDER=external sem AI_BASE_URL/AI_API_KEY/AI_MODEL. ' +
          'Mantendo o módulo desativado até que as credenciais sejam configuradas.',
      );
      return new DisabledAiProvider();
    }

    logger.log(`Módulo de IA habilitado com o provedor externo (modelo "${model}").`);
    return new ExternalAiProvider({ baseUrl, apiKey, model, timeoutMs: readTimeoutMs(config) });
  }

  logger.warn(
    `Provedor de IA "${kind}" não é reconhecido nesta versão. ` +
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
