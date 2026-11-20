import { Global, Module } from '@nestjs/common';

import { ProjectAccessService } from './project-access.service';

/**
 * Disponibiliza a autorização por projeto globalmente para que a
 * `ProjectAccessGuard` e os serviços de domínio reutilizem a mesma lógica.
 */
@Global()
@Module({
  providers: [ProjectAccessService],
  exports: [ProjectAccessService],
})
export class AccessModule {}
