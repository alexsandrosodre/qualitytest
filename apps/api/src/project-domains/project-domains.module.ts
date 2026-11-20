import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { ProjectDomainsController } from './project-domains.controller';
import { ProjectDomainsService } from './project-domains.service';

@Module({
  imports: [AuditModule],
  controllers: [ProjectDomainsController],
  providers: [ProjectDomainsService, ProjectAccessGuard],
})
export class ProjectDomainsModule {}
