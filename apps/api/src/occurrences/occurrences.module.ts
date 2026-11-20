import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { OccurrencesController } from './occurrences.controller';
import { OccurrencesService } from './occurrences.service';

/**
 * Módulo de ocorrências (ETAPA 5).
 *
 * A autorização por projeto é delegada à `ProjectAccessService` (módulo global
 * `AccessModule`), reutilizando a mesma lógica do `ProjectAccessGuard`.
 */
@Module({
  imports: [AuditModule, StorageModule],
  controllers: [OccurrencesController],
  providers: [OccurrencesService],
})
export class OccurrencesModule {}
