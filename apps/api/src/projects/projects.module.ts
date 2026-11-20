import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuditModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
